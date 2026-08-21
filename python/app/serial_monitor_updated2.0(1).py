import serial
import serial.tools.list_ports
import numpy as np
import matplotlib.pyplot as plt
import logging
import threading
import queue
import time
import csv
import os
import onbed_filter as ncz  # Changed from nczallcode_wrapper
from matplotlib.gridspec import GridSpec
# from matplotlib.animation import FuncAnimation # No longer needed
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import collections
import matplotlib
matplotlib.use('TkAgg')

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei']  
plt.rcParams['axes.unicode_minus'] = False  
# 增加全局字体大小
plt.rcParams['font.size'] = 14 # Adjusted general font size from 12
plt.rcParams['axes.titlesize'] = 16 # Adjusted axes title size from 14
plt.rcParams['axes.labelsize'] = 14 # Adjusted labels size from 12
plt.rcParams['xtick.labelsize'] = 12 # Adjusted tick labels from 10
plt.rcParams['ytick.labelsize'] = 12 # Adjusted tick labels from 10

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ============================================================================
# ToolTip工具类 - 用于参数悬停提示
# ============================================================================
class ToolTip:
    """简单的Tooltip悬停提示实现，鼠标悬停时显示详细说明"""
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tip_window = None
        self.widget.bind("<Enter>", self.show_tip)
        self.widget.bind("<Leave>", self.hide_tip)

    def show_tip(self, event=None):
        """显示提示窗口"""
        if self.tip_window or not self.text:
            return
        # 获取widget位置
        x = self.widget.winfo_rootx() + 25
        y = self.widget.winfo_rooty() + 25

        # 创建顶层窗口
        self.tip_window = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)  # 无边框窗口
        tw.wm_geometry(f"+{x}+{y}")
        
        # 创建提示标签
        label = tk.Label(tw, text=self.text, justify=tk.LEFT,
                        background="#ffffe0", relief=tk.SOLID, borderwidth=1,
                        font=("微软雅黑", 9), padx=4, pady=2)
        label.pack()

    def hide_tip(self, event=None):
        """隐藏提示窗口"""
        if self.tip_window:
            self.tip_window.destroy()
            self.tip_window = None

class SerialMonitor:
    def __init__(self):
        # 串口相关
        self.ser = None
        self.alld = np.array([], dtype=np.uint8)
        self.running = False
        self.read_thread = None
        
        # 数据处理相关
        # self.matrix_data = np.zeros((32, 32), dtype=np.float32) # Managed by queues
        # self.frame_data = np.zeros(1024, dtype=np.float32) # Managed by queues
        self.new_data_event = threading.Event()
        self.data_lock = threading.Lock()
        
        # 算法处理相关
        self.processor_initialized = False
        self.processing_thread = None
        # self.result = None # Managed by queues
        # self.results_history = [] # Removed, plots are gone
        # self.history_length = 1000 # Removed
        self.start_time = time.time()
        self.frame_counter = 0
        
        # 帧率计算相关
        self.frame_times = collections.deque(maxlen=30)
        self.last_frame_time = time.time()
        self.current_fps = 0
        
        # 串口采集帧率计算相关
        self.serial_frame_times = collections.deque(maxlen=30)
        self.serial_fps = 0
        
        # 数据队列
        self.data_queue = queue.Queue(maxsize=20)
        self.result_queue = queue.Queue(maxsize=20)
        self.heatmap_queue = queue.Queue(maxsize=1)
        self.matrix_origin_queue = queue.Queue(maxsize=1) # New queue for matrix_origin
        self.matrix_filter_queue = queue.Queue(maxsize=1) # New queue for matrix_filter
        self.body_movement_queue = queue.Queue(maxsize=1) # New queue for bodyMovementData
        
        # 性能优化相关
        # self.plot_update_interval = 5 # Removed, plots are gone
        self.ui_update_counter = 0
        # self.last_plot_update_time = time.time() # Removed
        self.heatmap_scale_update_counter = 0
        self.heatmap_last_update_time = 0
        
        # Algorithm input parameters
        # self.threshold_factor_var = tk.StringVar(value="1.0") # Moved to setup_gui
        # self.continuous_on_bed_duration_minutes_var = tk.StringVar(value="5.0") # Moved to setup_gui
        # self.unlock_sitting_alarm_duration_minutes_var = tk.StringVar(value="10.0") # Moved to setup_gui
        # self.unlock_falling_alarm_duration_minutes_var = tk.StringVar(value="2.0") # Moved to setup_gui
        # self.sosPeakThreshold_var = tk.StringVar(value="0.8") # Moved to setup_gui

        # 定义标准字体 (Moved here for earlier access if needed, though primarily used in setup_gui)
        self.font_small = ('SimHei', 10) # For potentially smaller text if needed
        self.font_normal = ('SimHei', 12)
        self.font_medium = ('SimHei', 13)
        self.font_large = ('SimHei', 14)
        self.font_xlarge = ('SimHei', 16)
        
        # 新增：状态和报警相关成员变量
        self.STATE_IN_BED_MAP = {0: "离床", 1: "正常在床", 3: "坠床", 4: "坐床边状态", -1: "--"}
        self.MERGED_ALARM_MAP = {0: "无报警", 10: "离床报警", 11: "上床警报", 13: "坠床报警", 14: "坐床边报警", -1: "--"}
        self.alarm_history = collections.deque(maxlen=5)
        self.last_alarm_code_displayed = 0 # Tracks the last alarm code that triggered a popup
        
        # 新增: SOS 报警可视化相关
        self.sos_window = None
        self.last_sos_signal = np.zeros(159)  # 更新为159
        self.last_sos_coord = np.array([1, 1])
        self.sos_fig, self.sos_canvas, self.sos_ax1, self.sos_ax2, self.sos_hRect, self.sos_hPlot = None, None, None, None, None, None
        self.sos_heatmap_img = None  # 用于保存SOS窗口中的热力图对象
        self.latest_heatmap_data = np.zeros((32, 32), dtype=np.float32)  # 保存最新的热力图数据
        self.current_sos_sequence = 0  # 当前SOS报警序列计数，0表示无报警

        # 高级输出参数的tooltip对象存储
        self.array_tooltips = {}  # 存储数组参数的tooltip对象
        
        # 新增: bodyMovementData 柱状图相关
        self.body_movement_figure = None
        self.body_movement_canvas = None
        self.body_movement_ax = None
        self.body_movement_bars = None  # 存储24个柱状图

        # 新增: 体动数据历史缓冲（架构变更：从24维数组→1维标量+前端缓冲）
        self.body_movement_history = collections.deque(maxlen=24)
        for _ in range(24):
            self.body_movement_history.append(0.0)  # 初始化为0
        
        # 新增: 呼吸率日志记录相关
        self.rate_log = collections.deque(maxlen=10000)  # 最多存储10000条记录
        self.rate_log_lock = threading.Lock()  # 线程安全访问日志
        
        # 新增: 本地持久化存储相关
        self.logs_directory = "logs"  # 本地日志文件目录
        self.unsaved_count = 0  # 未保存的记录数量
        self.last_save_time = time.time()  # 上次保存时间
        self.save_threshold_count = 50  # 触发保存的记录数阈值
        self.save_threshold_time = 120  # 触发保存的时间间隔（秒）
        self.auto_save_timer_id = None  # 自动保存定时器ID
        
        # 创建日志目录
        self.create_logs_directory()
        
        # 创建GUI
        self.setup_gui()
        
        # 加载当天的本地日志数据
        self.load_local_rate_log()
        
    def setup_gui(self):
        self.root = tk.Tk()
        # Moved StringVar initializations here, after root window is created
        self.current_status_var = tk.StringVar(value="当前状态: --")
        self.current_alarm_var = tk.StringVar(value="当前报警: --")

        self.root.title("串口传感器数据监控与分析 (新版)")
        self.root.geometry("1450x1050") # Increased height to accommodate all plots including bodyMovementData curve
        
        # --- Style configuration for LabelFrame titles ---
        style = ttk.Style(self.root)
        style.configure("TLabelframe.Label", font=self.font_large) # For LabelFrame titles
        # For LabelFrame border/background if needed
        # style.configure("TLabelframe", background="white", bordercolor="gray", lightcolor="gray", darkcolor="gray")
        
        # Moved Algorithm input parameters initialization here
        self.threshold_factor_var = tk.StringVar(value="0.0")
        self.continuous_on_bed_duration_minutes_var = tk.StringVar(value="0.0")
        self.unlock_sitting_alarm_duration_minutes_var = tk.StringVar(value="0.0")
        self.sos_peak_threshold_var = tk.StringVar(value="0.0")
        self.points_threshold_in_var = tk.StringVar(value="0.0")

        # 新增标量参数（根据算法文档调整默认值）
        self.min_sos_sequence_var = tk.StringVar(value="0.0")
        self.breath_detect_mode_var = tk.StringVar(value="0.0")
        self.strel_switch_var = tk.StringVar(value="1.0")  # 建议默认开启散点滤波
        self.filter_switch_var = tk.StringVar(value="1.0")  # 建议默认开启
        self.body_movement_threshold_var = tk.StringVar(value="30.0")  # 建议默认30%
        self.step_leavebed_trigger_var = tk.StringVar(value="50.0")  # 建议默认50%
        self.edge_align_ratio_var = tk.StringVar(value="0.0")  # 默认80%

        # 新增数组参数（拆分为双输入框）
        # SOS屏蔽区域 [前, 后]
        self.sos_disable_area_front_var = tk.StringVar(value="6.0")
        self.sos_disable_area_back_var = tk.StringVar(value="10.0")

        # 坐床边宽度 [最小, 最大]
        self.sitting_area_min_var = tk.StringVar(value="0.0")
        self.sitting_area_max_var = tk.StringVar(value="0.0")

        # 边缘滤波区域 [前, 后]
        self.leave_bed_disable_area_front_var = tk.StringVar(value="0.0")
        self.leave_bed_disable_area_back_var = tk.StringVar(value="0.0")

        # 小物体滤波 [行, 列]
        self.small_object_size_row_var = tk.StringVar(value="0.0")
        self.small_object_size_col_var = tk.StringVar(value="0.0")

        # 头脚过滤区域 [床头, 床尾]
        self.head_foot_area_head_var = tk.StringVar(value="0.0")
        self.head_foot_area_foot_var = tk.StringVar(value="0.0")

        # 呼吸阈值
        self.breath_th_var = tk.StringVar(value="0.0")
        
        try:
            from ctypes import windll
            windll.shcore.SetProcessDpiAwareness(1)
        except:
            pass
        
        # --- Control Panel (Dual-Row Layout) ---
        control_main_frame = ttk.Frame(self.root, padding="10")
        control_main_frame.pack(fill=tk.X)
        
        # === First Row: Basic Controls ===
        first_row_frame = ttk.Frame(control_main_frame)
        first_row_frame.pack(fill=tk.X, pady=(0, 5))
        
        # Serial Port Controls
        serial_frame = ttk.Frame(first_row_frame)
        serial_frame.pack(side=tk.LEFT, padx=(0, 15))
        
        ttk.Label(serial_frame, text="串口:", font=self.font_medium).pack(side=tk.LEFT, padx=2)
        self.port_var = tk.StringVar()
        self.port_combo = ttk.Combobox(serial_frame, textvariable=self.port_var, font=self.font_normal, width=12)
        self.port_combo.pack(side=tk.LEFT, padx=2)
        self.refresh_button = ttk.Button(serial_frame, text="刷新", command=self.refresh_ports)
        self.refresh_button.pack(side=tk.LEFT, padx=2)
        
        # Monitoring Controls
        monitor_frame = ttk.Frame(first_row_frame)
        monitor_frame.pack(side=tk.LEFT, padx=(0, 15))
        
        self.start_button = ttk.Button(monitor_frame, text="启动", command=self.start_monitoring)
        self.start_button.pack(side=tk.LEFT, padx=2)
        self.stop_button = ttk.Button(monitor_frame, text="停止", command=self.stop_monitoring, state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT, padx=2)
        
        # FPS Display (Simplified)
        fps_frame = ttk.Frame(first_row_frame)
        fps_frame.pack(side=tk.LEFT, padx=(0, 15))
        
        ttk.Label(fps_frame, text="算法帧率:", font=self.font_medium).pack(side=tk.LEFT, padx=3)
        self.fps_label = ttk.Label(fps_frame, text="0 FPS", font=self.font_medium)
        self.fps_label.pack(side=tk.LEFT, padx=3)
        
        ttk.Label(fps_frame, text="采集帧率:", font=self.font_medium).pack(side=tk.LEFT, padx=3)
        self.serial_fps_label = ttk.Label(fps_frame, text="0 FPS", font=self.font_medium)
        self.serial_fps_label.pack(side=tk.LEFT, padx=3)
        
        ttk.Label(fps_frame, text="UI帧率:", font=self.font_medium).pack(side=tk.LEFT, padx=3)
        self.ui_fps_label = ttk.Label(fps_frame, text="0 FPS", font=self.font_medium)
        self.ui_fps_label.pack(side=tk.LEFT, padx=3)
        self.ui_frame_times = collections.deque(maxlen=10)
        
        # Rate Log Status (Summary Only)
        status_frame = ttk.Frame(first_row_frame)
        status_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Label(status_frame, text="呼吸率日志:", font=self.font_medium).pack(side=tk.LEFT, padx=3)
        self.rate_log_count_label = ttk.Label(status_frame, text="0条", font=self.font_medium)
        self.rate_log_count_label.pack(side=tk.LEFT, padx=3)
        
        self.unsaved_count_label = ttk.Label(status_frame, text="待保存: 0条", font=self.font_medium, foreground="orange")
        self.unsaved_count_label.pack(side=tk.LEFT, padx=3)
        
        # === Second Row: Advanced Controls ===
        second_row_frame = ttk.Frame(control_main_frame)
        second_row_frame.pack(fill=tk.X, pady=(5, 0))

        # Algorithm Parameters - 分为4组
        # 基础参数组
        basic_params_frame = ttk.LabelFrame(second_row_frame, text="基础参数", padding="5")
        basic_params_frame.pack(side=tk.LEFT, padx=(0, 5), fill=tk.Y)

        ttk.Label(basic_params_frame, text="离床阈值:", font=self.font_normal).grid(row=0, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(basic_params_frame, textvariable=self.threshold_factor_var, width=6, font=self.font_normal).grid(row=0, column=1, padx=2, pady=2)

        ttk.Label(basic_params_frame, text="在床持续(min):", font=self.font_normal).grid(row=1, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(basic_params_frame, textvariable=self.continuous_on_bed_duration_minutes_var, width=6, font=self.font_normal).grid(row=1, column=1, padx=2, pady=2)

        ttk.Label(basic_params_frame, text="坐床解锁(min):", font=self.font_normal).grid(row=2, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(basic_params_frame, textvariable=self.unlock_sitting_alarm_duration_minutes_var, width=6, font=self.font_normal).grid(row=2, column=1, padx=2, pady=2)

        # SOS参数组
        sos_params_frame = ttk.LabelFrame(second_row_frame, text="SOS参数", padding="5")
        sos_params_frame.pack(side=tk.LEFT, padx=(0, 5), fill=tk.Y)

        ttk.Label(sos_params_frame, text="拍打力度:", font=self.font_normal).grid(row=0, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(sos_params_frame, textvariable=self.sos_peak_threshold_var, width=6, font=self.font_normal).grid(row=0, column=1, padx=2, pady=2)

        ttk.Label(sos_params_frame, text="拍打点数:", font=self.font_normal).grid(row=1, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(sos_params_frame, textvariable=self.points_threshold_in_var, width=6, font=self.font_normal).grid(row=1, column=1, padx=2, pady=2)

        # 屏蔽区 - 双输入框 + Tooltip
        screen_label = ttk.Label(sos_params_frame, text="屏蔽区:", font=self.font_normal)
        screen_label.grid(row=2, column=0, padx=2, pady=2, sticky=tk.W)
        ToolTip(screen_label, "SOS屏蔽区域：前m行，后n行。\n建议(6,10)，输入0,0表示不屏蔽")

        ttk.Label(sos_params_frame, text="前", font=self.font_normal, foreground="gray").grid(row=2, column=1, sticky=tk.E, padx=(2,0))
        ttk.Entry(sos_params_frame, textvariable=self.sos_disable_area_front_var, width=4, font=self.font_normal).grid(row=2, column=2, padx=1, pady=2)

        ttk.Label(sos_params_frame, text="后", font=self.font_normal, foreground="gray").grid(row=2, column=3, sticky=tk.E, padx=(2,0))
        ttk.Entry(sos_params_frame, textvariable=self.sos_disable_area_back_var, width=4, font=self.font_normal).grid(row=2, column=4, padx=(1,2), pady=2)

        ttk.Label(sos_params_frame, text="连续次数:", font=self.font_normal).grid(row=3, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(sos_params_frame, textvariable=self.min_sos_sequence_var, width=6, font=self.font_normal).grid(row=3, column=1, padx=2, pady=2)

        # 滤波参数组
        filter_params_frame = ttk.LabelFrame(second_row_frame, text="滤波参数", padding="5")
        filter_params_frame.pack(side=tk.LEFT, padx=(0, 5), fill=tk.Y)

        ttk.Label(filter_params_frame, text="总开关:", font=self.font_normal).grid(row=0, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(filter_params_frame, textvariable=self.filter_switch_var, width=6, font=self.font_normal).grid(row=0, column=1, padx=2, pady=2)

        ttk.Label(filter_params_frame, text="散点滤波:", font=self.font_normal).grid(row=1, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(filter_params_frame, textvariable=self.strel_switch_var, width=6, font=self.font_normal).grid(row=1, column=1, padx=2, pady=2)

        # 边缘滤波 - 双输入框 + Tooltip
        edge_label = ttk.Label(filter_params_frame, text="边缘滤波:", font=self.font_normal)
        edge_label.grid(row=2, column=0, padx=2, pady=2, sticky=tk.W)
        ToolTip(edge_label, "在离床滤波的边缘区域：前m行(床头)，后n行(床尾)。\n输入0,0使用默认(6,8)")

        ttk.Label(filter_params_frame, text="前", font=self.font_normal, foreground="gray").grid(row=2, column=1, sticky=tk.E, padx=(2,0))
        ttk.Entry(filter_params_frame, textvariable=self.leave_bed_disable_area_front_var, width=4, font=self.font_normal).grid(row=2, column=2, padx=1, pady=2)

        ttk.Label(filter_params_frame, text="后", font=self.font_normal, foreground="gray").grid(row=2, column=3, sticky=tk.E, padx=(2,0))
        ttk.Entry(filter_params_frame, textvariable=self.leave_bed_disable_area_back_var, width=4, font=self.font_normal).grid(row=2, column=4, padx=(1,2), pady=2)

        # 小物体滤波 - 双输入框 + Tooltip
        small_obj_label = ttk.Label(filter_params_frame, text="小物体:", font=self.font_normal)
        small_obj_label.grid(row=3, column=0, padx=2, pady=2, sticky=tk.W)
        ToolTip(small_obj_label, "小物体尺寸：m行×n列。\n小于此尺寸的物体会被滤除，输入0,0使用默认(3,4)")

        ttk.Label(filter_params_frame, text="行", font=self.font_normal, foreground="gray").grid(row=3, column=1, sticky=tk.E, padx=(2,0))
        ttk.Entry(filter_params_frame, textvariable=self.small_object_size_row_var, width=4, font=self.font_normal).grid(row=3, column=2, padx=1, pady=2)

        ttk.Label(filter_params_frame, text="列", font=self.font_normal, foreground="gray").grid(row=3, column=3, sticky=tk.E, padx=(2,0))
        ttk.Entry(filter_params_frame, textvariable=self.small_object_size_col_var, width=4, font=self.font_normal).grid(row=3, column=4, padx=(1,2), pady=2)

        # 高级参数组
        advanced_params_frame = ttk.LabelFrame(second_row_frame, text="高级参数", padding="5")
        advanced_params_frame.pack(side=tk.LEFT, padx=(0, 5), fill=tk.Y)

        ttk.Label(advanced_params_frame, text="呼吸模式:", font=self.font_normal).grid(row=0, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(advanced_params_frame, textvariable=self.breath_detect_mode_var, width=6, font=self.font_normal).grid(row=0, column=1, padx=2, pady=2)

        # 坐床边宽度 - 双输入框 + Tooltip
        sitting_label = ttk.Label(advanced_params_frame, text="坐床宽:", font=self.font_normal)
        sitting_label.grid(row=1, column=0, padx=2, pady=2, sticky=tk.W)
        ToolTip(sitting_label, "坐床边屁股宽度范围：最小m行，最大n行。\n输入0,0使用默认(4,12)，输入255,255关闭识别")

        ttk.Label(advanced_params_frame, text="最小", font=self.font_normal, foreground="gray").grid(row=1, column=1, sticky=tk.E, padx=(2,0))
        ttk.Entry(advanced_params_frame, textvariable=self.sitting_area_min_var, width=4, font=self.font_normal).grid(row=1, column=2, padx=1, pady=2)

        ttk.Label(advanced_params_frame, text="最大", font=self.font_normal, foreground="gray").grid(row=1, column=3, sticky=tk.E, padx=(2,0))
        ttk.Entry(advanced_params_frame, textvariable=self.sitting_area_max_var, width=4, font=self.font_normal).grid(row=1, column=4, padx=(1,2), pady=2)

        ttk.Label(advanced_params_frame, text="体动阈值:", font=self.font_normal).grid(row=2, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(advanced_params_frame, textvariable=self.body_movement_threshold_var, width=6, font=self.font_normal).grid(row=2, column=1, padx=2, pady=2)

        ttk.Label(advanced_params_frame, text="离床辅助:", font=self.font_normal).grid(row=3, column=0, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(advanced_params_frame, textvariable=self.step_leavebed_trigger_var, width=6, font=self.font_normal).grid(row=3, column=1, padx=2, pady=2)

        ttk.Label(advanced_params_frame, text="边缘对齐:", font=self.font_normal).grid(row=0, column=2, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(advanced_params_frame, textvariable=self.edge_align_ratio_var, width=6, font=self.font_normal).grid(row=0, column=3, padx=2, pady=2)

        # 头脚过滤 - 双输入框 + Tooltip
        head_foot_label = ttk.Label(advanced_params_frame, text="头脚过滤:", font=self.font_normal)
        head_foot_label.grid(row=1, column=5, padx=2, pady=2, sticky=tk.W)
        ToolTip(head_foot_label, "过滤床头床尾区域重心：床头m行，床尾n行。\n输入0,0使用默认(2,2)，避免枕头/被子干扰")

        ttk.Label(advanced_params_frame, text="床头", font=self.font_normal, foreground="gray").grid(row=1, column=6, sticky=tk.E, padx=(2,0))
        ttk.Entry(advanced_params_frame, textvariable=self.head_foot_area_head_var, width=4, font=self.font_normal).grid(row=1, column=7, padx=1, pady=2)

        ttk.Label(advanced_params_frame, text="床尾", font=self.font_normal, foreground="gray").grid(row=1, column=8, sticky=tk.E, padx=(2,0))
        ttk.Entry(advanced_params_frame, textvariable=self.head_foot_area_foot_var, width=4, font=self.font_normal).grid(row=1, column=9, padx=(1,2), pady=2)

        ttk.Label(advanced_params_frame, text="呼吸阈值:", font=self.font_normal).grid(row=2, column=5, padx=2, pady=2, sticky=tk.W)
        ttk.Entry(advanced_params_frame, textvariable=self.breath_th_var, width=6, font=self.font_normal).grid(row=2, column=6, padx=2, pady=2)
        rate_log_frame = ttk.LabelFrame(second_row_frame, text="数据日志操作", padding="5")
        rate_log_frame.pack(side=tk.LEFT, padx=(0, 10), fill=tk.Y)
        
        # 操作按钮排列为两行以节省水平空间
        self.export_csv_button = ttk.Button(rate_log_frame, text="导出CSV", command=self.export_rate_log_to_csv)
        self.export_csv_button.grid(row=0, column=0, padx=3, pady=2, sticky=tk.W+tk.E)
        
        self.manual_save_button = ttk.Button(rate_log_frame, text="立即保存", command=self.manual_save_rate_log)
        self.manual_save_button.grid(row=0, column=1, padx=3, pady=2, sticky=tk.W+tk.E)
        
        self.clear_log_button = ttk.Button(rate_log_frame, text="清空日志", command=self.clear_rate_log)
        self.clear_log_button.grid(row=1, column=0, columnspan=2, padx=3, pady=2, sticky=tk.W+tk.E)
        
        # --- Main Layout ---
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Left part of main_frame: Original heatmap and new matrix heatmaps
        left_plots_frame = ttk.Frame(main_frame)
        left_plots_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Original Heatmap Frame (Top Left)
        self.heatmap_frame = ttk.Frame(left_plots_frame)
        self.heatmap_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=False, padx=0, pady=2) # Reduced space allocation
        
        self.heatmap_figure, self.heatmap_ax = plt.subplots(figsize=(4,3.5), dpi=90) # Reduced size for space saving
        self.heatmap_canvas = FigureCanvasTkAgg(self.heatmap_figure, master=self.heatmap_frame)
        self.heatmap_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        self.heatmap_data = np.zeros((32, 32), dtype=np.float32)
        self.heatmap = self.heatmap_ax.imshow(self.heatmap_data, cmap='viridis', interpolation='nearest', vmin=0, vmax=255)
        self.colorbar = self.heatmap_figure.colorbar(self.heatmap, ax=self.heatmap_ax, label='压力值') # Label font controlled by rcParams['axes.labelsize']
        self.heatmap_ax.set_title("传感器热力图", fontsize=self.font_xlarge[1], fontweight='bold') # Use defined font size
        self.heatmap_ax.set_xticks([])
        self.heatmap_ax.set_yticks([])
        self.heatmap_figure.tight_layout()

        # New Matrix Heatmaps Frame (Below Original Heatmap)
        matrix_heatmaps_container = ttk.Frame(left_plots_frame)
        matrix_heatmaps_container.pack(side=tk.TOP, fill=tk.BOTH, expand=False, padx=0, pady=2) # Reduced space allocation

        # Matrix Origin Heatmap Frame (Left in container)
        self.matrix_origin_frame = ttk.Frame(matrix_heatmaps_container)
        self.matrix_origin_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=2, pady=0)

        self.matrix_origin_figure, self.matrix_origin_ax = plt.subplots(figsize=(3,2.5), dpi=90) # Reduced size for space saving
        self.matrix_origin_canvas = FigureCanvasTkAgg(self.matrix_origin_figure, master=self.matrix_origin_frame)
        self.matrix_origin_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        self.matrix_origin_data = np.zeros((32, 32), dtype=np.float32)
        self.matrix_origin_heatmap = self.matrix_origin_ax.imshow(self.matrix_origin_data, cmap='viridis', interpolation='nearest', vmin=0, vmax=255)
        self.matrix_origin_colorbar = self.matrix_origin_figure.colorbar(self.matrix_origin_heatmap, ax=self.matrix_origin_ax, label='值')
        self.matrix_origin_ax.set_title("原始矩阵热力图", fontsize=self.font_medium[1])
        self.matrix_origin_ax.set_xticks([])
        self.matrix_origin_ax.set_yticks([])
        self.matrix_origin_figure.tight_layout()

        # Matrix Filter Heatmap Frame (Right in container)
        self.matrix_filter_frame = ttk.Frame(matrix_heatmaps_container)
        self.matrix_filter_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=2, pady=0)

        self.matrix_filter_figure, self.matrix_filter_ax = plt.subplots(figsize=(3,2.5), dpi=90) # Reduced size for space saving
        self.matrix_filter_canvas = FigureCanvasTkAgg(self.matrix_filter_figure, master=self.matrix_filter_frame)
        self.matrix_filter_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        self.matrix_filter_data = np.zeros((32, 32), dtype=np.float32)
        self.matrix_filter_heatmap = self.matrix_filter_ax.imshow(self.matrix_filter_data, cmap='viridis', interpolation='nearest', vmin=0, vmax=255)
        self.matrix_filter_colorbar = self.matrix_filter_figure.colorbar(self.matrix_filter_heatmap, ax=self.matrix_filter_ax, label='值')
        self.matrix_filter_ax.set_title("滤波矩阵热力图", fontsize=self.font_medium[1])
        self.matrix_filter_ax.set_xticks([])
        self.matrix_filter_ax.set_yticks([])
        self.matrix_filter_figure.tight_layout()

        # Body Movement Data Plot Frame (Below Matrix Heatmaps)
        self.body_movement_frame = ttk.Frame(left_plots_frame)
        self.body_movement_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=0, pady=2) # This will take remaining space

        self.body_movement_figure, self.body_movement_ax = plt.subplots(figsize=(8,4), dpi=90)
        self.body_movement_canvas = FigureCanvasTkAgg(self.body_movement_figure, master=self.body_movement_frame)
        self.body_movement_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # 初始化24个柱状图
        x_positions = range(1, 25)  # 1到24的位置
        initial_heights = [0] * 24  # 初始高度为0
        self.body_movement_bars = self.body_movement_ax.bar(x_positions, initial_heights, color='steelblue', alpha=0.7)
        
        self.body_movement_ax.set_title("体动等级历史趋势", fontsize=self.font_medium[1])
        self.body_movement_ax.set_xlabel("历史序列（左旧→右新）")
        self.body_movement_ax.set_ylabel("体动等级（1-10）")
        self.body_movement_ax.grid(True, alpha=0.3, axis='y')
        self.body_movement_ax.set_xlim(0.5, 24.5)  # X轴范围：1-24
        self.body_movement_ax.set_ylim(0, 10)      # Y轴固定范围：0-10
        self.body_movement_ax.set_xticks(range(1, 25, 2))  # 显示1,3,5,...23的刻度
        self.body_movement_figure.tight_layout()
        
        # Algorithm Output Panel (Right) - Adjusted to pack next to left_plots_frame
        output_panel_frame = ttk.LabelFrame(main_frame, text="算法输出状态", padding="10")
        output_panel_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.status_labels = {}
        
        # Define status items in groups
        # Group 1: Real-time data (when rate != -1)
        real_time_group = ttk.LabelFrame(output_panel_frame, text="实时数据 (rate != -1时更新)", padding="5")
        real_time_group.pack(fill=tk.X, pady=5)

        rt_items = ["rate", "stroke_risk", "state_in_bed", "onbed_ratio",
                    "sos_flag", "merged_alarm", "current_threshold",
                    "on_bed_duration_minutes", "sitting_alarm_duration_minutes",
                    "body_movement_flag", "runtime", "reserved_bytes_0_2"]
        for i, item_key in enumerate(rt_items):
            display_text = item_key.replace("_", " ").title()
            ttk.Label(real_time_group, text=f"{display_text}:", font=self.font_normal).grid(row=i//2, column=(i%2)*2, sticky=tk.W, padx=3, pady=1)
            self.status_labels[item_key] = ttk.Label(real_time_group, text="--", font=self.font_normal, width=12) # Increased width
            self.status_labels[item_key].grid(row=i//2, column=(i%2)*2+1, sticky=tk.W, padx=3, pady=1)

        # Manually add "算法运行时长" to real_time_group
        runtime_label_row = len(rt_items) // 2
        runtime_label_col_start = (len(rt_items) % 2) * 2
        ttk.Label(real_time_group, text="算法运行时长:", font=self.font_normal).grid(row=runtime_label_row, column=runtime_label_col_start, sticky=tk.W, padx=3, pady=1)
        self.status_labels["runtime"] = ttk.Label(real_time_group, text="--", font=self.font_normal, width=12) # Create/re-parent here, increased width
        self.status_labels["runtime"].grid(row=runtime_label_row, column=runtime_label_col_start + 1, sticky=tk.W, padx=3, pady=1)

        # Group 2: Minute data (when rate_minute != -1)
        minute_data_group = ttk.LabelFrame(output_panel_frame, text="分钟数据 (rate_minute != -1时更新)", padding="5")
        minute_data_group.pack(fill=tk.X, pady=5)

        min_items = ["rate_minute", "onbed_ratio_minute", "awake_state", "onbed_state"]
        for i, item_key in enumerate(min_items):
            display_text = item_key.replace("_", " ").title()
            ttk.Label(minute_data_group, text=f"{display_text}:", font=self.font_normal).grid(row=i//2, column=(i%2)*2, sticky=tk.W, padx=3, pady=1)
            self.status_labels[item_key] = ttk.Label(minute_data_group, text="--", font=self.font_normal, width=12) # Increased width
            self.status_labels[item_key].grid(row=i//2, column=(i%2)*2+1, sticky=tk.W, padx=3, pady=1)

        # NEW Group: Alarm Counts
        alarm_counts_group = ttk.LabelFrame(output_panel_frame, text="报警计数", padding="5")
        alarm_counts_group.pack(fill=tk.X, pady=5)

        alarm_count_items = {
            "leave_bed_alarms": "累计离床报警:",
            "sit_edge_alarms": "累计坐床边报警:",
            "fall_bed_alarms": "累计坠床报警:",
            "sos_alarms": "累计SOS报警:"
        }
        
        alarm_keys = list(alarm_count_items.keys())
        for i, key in enumerate(alarm_keys):
            display_text = alarm_count_items[key]
            ttk.Label(alarm_counts_group, text=display_text, font=self.font_normal).grid(row=i//2, column=(i%2)*2, sticky=tk.W, padx=3, pady=1)
            self.status_labels[key] = ttk.Label(alarm_counts_group, text="--", font=self.font_normal, width=12)
            self.status_labels[key].grid(row=i//2, column=(i%2)*2+1, sticky=tk.W, padx=3, pady=1)

        # Group 3: General data
        general_data_group = ttk.LabelFrame(output_panel_frame, text="通用状态", padding="5")
        general_data_group.pack(fill=tk.X, pady=5)

        self.status_labels["处理帧数"] = ttk.Label(general_data_group, text="--", font=self.font_normal, width=12) # Pre-add for ordering, increased width

        ttk.Label(general_data_group, text="算法版本:", font=self.font_normal).grid(row=0, column=0, sticky=tk.W, padx=3, pady=1) # Adjusted grid
        self.status_labels["version_info"] = ttk.Label(general_data_group, text="--", font=self.font_normal, width=12) # Increased width
        self.status_labels["version_info"].grid(row=0, column=1, sticky=tk.W, padx=3, pady=1) # Adjusted grid

        ttk.Label(general_data_group, text="处理帧数:", font=self.font_normal).grid(row=0, column=2, sticky=tk.W, padx=3, pady=1) # Adjusted grid
        self.status_labels["处理帧数"] = ttk.Label(general_data_group, text="--", font=self.font_normal, width=12) # Ensure this is created before gridding, increased width
        self.status_labels["处理帧数"].grid(row=0, column=3, sticky=tk.W, padx=3, pady=1) # Adjusted grid

        # Group 4: Advanced Output Parameters (Arrays)
        advanced_output_group = ttk.LabelFrame(output_panel_frame, text="高级输出参数（数组）", padding="5")
        advanced_output_group.pack(fill=tk.X, pady=5)

        adv_items = [
            ("merged_switch", "功能开关"),
            ("filter_param", "滤波参数"),
            ("sos_param", "SOS参数"),
            ("sitting_area_out", "坐床边参数")
        ]

        for i, (key, label) in enumerate(adv_items):
            ttk.Label(advanced_output_group, text=f"{label}:", font=self.font_normal).grid(
                row=i//2, column=(i%2)*2, sticky=tk.W, padx=3, pady=1)
            self.status_labels[key] = ttk.Label(advanced_output_group, text="--",
                font=self.font_normal, width=40)
            self.status_labels[key].grid(row=i//2, column=(i%2)*2+1, sticky=tk.W, padx=3, pady=1)
        
        # --- Status and Alarm History Panel (New) ---
        status_alarm_frame = ttk.LabelFrame(output_panel_frame, text="实时状态与报警记录", padding="10") # Increased padding
        # Pack this frame at the bottom of output_panel_frame, ensuring it expands width-wise but not necessarily height-wise unless content pushes it
        status_alarm_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=10, padx=5, expand=False) 

        # Current Status Display
        current_status_label = ttk.Label(status_alarm_frame, textvariable=self.current_status_var, font=self.font_large) 
        current_status_label.pack(side=tk.TOP, fill=tk.X, padx=5, pady=3)
        
        current_alarm_label = ttk.Label(status_alarm_frame, textvariable=self.current_alarm_var, font=self.font_large) 
        current_alarm_label.pack(side=tk.TOP, fill=tk.X, padx=5, pady=3)
        
        # Alarm History Display
        alarm_history_title_label = ttk.Label(status_alarm_frame, text="最近5条报警记录:", font=self.font_medium) # slightly smaller than large
        alarm_history_title_label.pack(side=tk.TOP, fill=tk.X, padx=5, pady=(8,2)) # more padding top
        
        self.alarm_history_listbox = tk.Listbox(status_alarm_frame, height=5, font=self.font_normal, width=45) # Adjusted width
        self.alarm_history_listbox.pack(side=tk.TOP, fill=tk.X, expand=True, padx=5, pady=3)

        # Closing event
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.refresh_ports()
        self.heatmap_timer_id = None
        self.update_timer_id = None
        self.matrix_origin_timer_id = None # For matrix_origin heatmap updates
        self.matrix_filter_timer_id = None # For matrix_filter heatmap updates
        self.body_movement_timer_id = None # For body movement plot updates

    def get_algo_params(self):
        """Safely get algorithm parameters from GUI inputs."""
        params = {}

        # 标量参数解析
        scalar_params = {
            'threshold_factor': (self.threshold_factor_var, 0.0),
            'continuous_on_bed_duration_minutes': (self.continuous_on_bed_duration_minutes_var, 0.0),
            'unlock_sitting_alarm_duration_minutes': (self.unlock_sitting_alarm_duration_minutes_var, 0.0),
            'sos_peak_threshold': (self.sos_peak_threshold_var, 0.0),
            'points_threshold_in': (self.points_threshold_in_var, 0.0),
            'min_sos_sequence': (self.min_sos_sequence_var, 0.0),
            'breath_detect_mode': (self.breath_detect_mode_var, 0.0),
            'strel_switch': (self.strel_switch_var, 0.0),
            'filter_switch': (self.filter_switch_var, 1.0),  # 默认开启
            'body_movement_threshold': (self.body_movement_threshold_var, 0.0),
            'step_leavebed_trigger': (self.step_leavebed_trigger_var, 0.0),
            'edge_align_ratio': (self.edge_align_ratio_var, 0.0),
            'breath_th': (self.breath_th_var, 0.0),
        }

        for key, (var, default) in scalar_params.items():
            try:
                params[key] = float(var.get())
            except ValueError:
                params[key] = default
                logging.warning(f"无效的 {key} 输入, 使用默认值 {default}")

        # 数组参数解析（双输入框）
        array_params_dual = {
            'sos_disable_area': (
                self.sos_disable_area_front_var,
                self.sos_disable_area_back_var,
                [6.0, 10.0]
            ),
            'sitting_area': (
                self.sitting_area_min_var,
                self.sitting_area_max_var,
                [0.0, 0.0]
            ),
            'leave_bed_disable_area': (
                self.leave_bed_disable_area_front_var,
                self.leave_bed_disable_area_back_var,
                [0.0, 0.0]
            ),
            'small_object_size': (
                self.small_object_size_row_var,
                self.small_object_size_col_var,
                [0.0, 0.0]
            ),
            'head_foot_area': (
                self.head_foot_area_head_var,
                self.head_foot_area_foot_var,
                [0.0, 0.0]
            ),
        }

        for key, (var1, var2, default) in array_params_dual.items():
            try:
                val1 = float(var1.get())
                val2 = float(var2.get())
                params[key] = np.array([val1, val2], dtype=np.float32)
            except ValueError:
                params[key] = np.array(default, dtype=np.float32)
                logging.warning(f"无效的 {key} 输入, 使用默认值 {default}")

        return params

    def refresh_ports(self):
        available_ports = list(serial.tools.list_ports.comports())
        port_names = [port.device for port in available_ports]
        self.port_combo['values'] = port_names
        if port_names:
            self.port_combo.current(0)
    
    def setup_serial_port(self):
        port = self.port_var.get()
        if not port:
            messagebox.showerror("错误", "未选择串口设备")
            return False
        try:
            self.ser = serial.Serial(port, 1000000, timeout=1)
            logging.info(f'成功连接到串口: {port}')
            return True
        except Exception as e:
            messagebox.showerror("错误", f"串口连接失败: {e}")
            logging.error(f"串口连接失败: {e}")
            return False
    
    def start_monitoring(self):
        if self.setup_serial_port():
            self.running = True
            if not self.processor_initialized:
                ncz.initialize()
                self.processor_initialized = True
                logging.info("算法包已初始化")
            
            self.ui_update_counter = 0
            self.start_time = time.time()
            self.heatmap_scale_update_counter = 0
            self.frame_counter = 0
            
            self.read_thread = threading.Thread(target=self.read_serial_data)
            self.read_thread.daemon = True
            self.read_thread.start()
            
            self.processing_thread = threading.Thread(target=self.processing_loop)
            self.processing_thread.daemon = True
            self.processing_thread.start()
            
            self.start_button.config(state=tk.DISABLED)
            self.stop_button.config(state=tk.NORMAL)
            self.port_combo.config(state=tk.DISABLED)
            self.refresh_button.config(state=tk.DISABLED)
            
            self.heatmap_timer_id = self.root.after(30, self.update_heatmap) # approx 33 FPS for heatmap
            self.update_timer_id = self.root.after(30, self.update_ui) # UI updates at ~33 FPS (was 100ms before)
            self.matrix_origin_timer_id = self.root.after(35, self.update_matrix_origin_heatmap) # Slightly offset
            self.matrix_filter_timer_id = self.root.after(40, self.update_matrix_filter_heatmap) # Slightly offset
            self.body_movement_timer_id = self.root.after(50, self.update_body_movement_plot) # Body movement plot updates
            
            logging.info("监控已启动")
    
    def stop_monitoring(self):
        self.running = False
        if self.update_timer_id:
            self.root.after_cancel(self.update_timer_id)
            self.update_timer_id = None
        if self.heatmap_timer_id:
            self.root.after_cancel(self.heatmap_timer_id)
            self.heatmap_timer_id = None
        if self.matrix_origin_timer_id:
            self.root.after_cancel(self.matrix_origin_timer_id)
            self.matrix_origin_timer_id = None
        if self.matrix_filter_timer_id:
            self.root.after_cancel(self.matrix_filter_timer_id)
            self.matrix_filter_timer_id = None
        if self.body_movement_timer_id:
            self.root.after_cancel(self.body_movement_timer_id)
            self.body_movement_timer_id = None
        
        if self.read_thread and self.read_thread.is_alive():
            self.read_thread.join(timeout=1.0)
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=1.0)
        
        if self.ser and self.ser.is_open:
            self.ser.close()
            logging.info("串口已关闭")
        
        self.start_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
        self.port_combo.config(state=tk.NORMAL)
        self.refresh_button.config(state=tk.NORMAL)
        
        logging.info("监控已停止")
    
    def find_packet_start(self, data):
        return np.where(np.all(np.array([data[i:i+4] for i in range(len(data)-3)]) == [170, 85, 3, 153], axis=1))[0]
    
    def process_matrix_data(self, matrix_data_bytes):
        if len(matrix_data_bytes) != 1024:
            return None
        img_data = np.array(matrix_data_bytes).flatten()
        for i in range(8):
            start1, end1 = i * 32, (i + 1) * 32
            start2, end2 = (14 - i) * 32, (15 - i) * 32
            img_data[start1:end1], img_data[start2:end2] = img_data[start2:end2].copy(), img_data[start1:end1].copy()
        img_data = np.roll(img_data, -15 * 32)
        return img_data
    
    def read_serial_data(self):
        self.alld = np.array([], dtype=np.uint8)
        last_data_time = time.time()
        
        while self.running and self.ser and self.ser.is_open:
            try:
                if self.ser.in_waiting > 0:
                    receive = self.ser.read(self.ser.in_waiting)
                    self.alld = np.concatenate([self.alld, np.frombuffer(receive, dtype=np.uint8)])
                    
                    if len(self.alld) >= 4:
                        index = self.find_packet_start(self.alld)
                        if len(index) > 0:
                            if index[0] > 0:
                                self.alld = self.alld[index[0]:]
                            if len(self.alld) >= 1028:
                                imgdata_bytes = self.alld[4:1028]
                                self.alld = self.alld[1028:]
                                
                                if len(imgdata_bytes) == 1024:
                                    # 1. 首先准备送入算法的原始数据
                                    # 将原始字节数据转换为 float32 numpy 数组
                                    raw_frame_data_for_algo = np.frombuffer(imgdata_bytes, dtype=np.uint8).astype(np.float32)
                                    
                                    # 将原始数据放入算法处理队列
                                    try:
                                        #尝试清理队列，防止处理不过来导致持续累积旧数据
                                        if self.data_queue.qsize() > 5: # 如果队列中积压数据过多
                                            # logging.debug(f"Data queue size {self.data_queue.qsize()} before clearing for raw data")
                                            for _ in range(self.data_queue.qsize() - 2): # 保留最新的几个
                                                try: self.data_queue.get_nowait() 
                                                except queue.Empty: break
                                        self.data_queue.put_nowait(raw_frame_data_for_algo)
                                        last_data_time = time.time()
                                    except queue.Full:
                                        # logging.warning("Data queue full when trying to put raw_frame_data_for_algo. Clearing half.")
                                        # 如果仍然满了，尝试清空一半，再放入
                                        try:
                                            for _ in range(self.data_queue.qsize() // 2):
                                                self.data_queue.get_nowait()
                                            self.data_queue.put_nowait(raw_frame_data_for_algo)
                                            last_data_time = time.time()
                                        except queue.Empty: pass
                                        except queue.Full: pass # 如果还是满的，就丢弃这一帧
                                        except Exception as e_dq_clear: logging.debug(f"Data queue clear/put error: {e_dq_clear}")
                                    except Exception as e_dq: logging.debug(f"Data queue put error (raw): {e_dq}")

                                    # 2. 然后处理用于第一个热力图的线序调整后数据
                                    processed_data_flat = self.process_matrix_data(imgdata_bytes) # imgdata_bytes 仍然是原始uint8数据
                                    if processed_data_flat is not None:
                                        # processed_data_flat 是 process_matrix_data 返回的调整线序后的 uint8 flatten array
                                        # 热力图通常也需要 float 数据进行颜色映射，并且原始热力图之前也是用的 float
                                        matrix_data_for_heatmap = processed_data_flat.astype(np.float32).reshape(32, 32)
                                        # frame_data_for_algo = np.asarray(processed_data_flat, dtype=np.float32) # 这行不再需要这样生成算法数据
                                        
                                        now = time.time()
                                        self.serial_frame_times.append(now)
                                        if len(self.serial_frame_times) >= 2:
                                            elapsed = self.serial_frame_times[-1] - self.serial_frame_times[0]
                                            if elapsed > 0:
                                                self.serial_fps = (len(self.serial_frame_times) - 1) / elapsed
                                        
                                        try:
                                            if self.heatmap_queue.full(): self.heatmap_queue.get_nowait()
                                            self.heatmap_queue.put_nowait(matrix_data_for_heatmap.copy())
                                        except queue.Full: pass # Silently drop if full after trying to clear
                                        except Exception as e_hq: logging.debug(f"Heatmap queue put error: {e_hq}")

                                        # try:
                                        #     self.data_queue.put_nowait(frame_data_for_algo) # Only pass frame_data for algorithm
                                        #     last_data_time = time.time()
                                        # except queue.Full:
                                        #     if time.time() - last_data_time > 0.5:
                                        #         try:
                                        #             for _ in range(self.data_queue.qsize() // 2): self.data_queue.get_nowait()
                                        #         except queue.Empty: pass
                                        #         except Exception as e_dq_clear: logging.debug(f"Data queue clear error: {e_dq_clear}")
                                        # except Exception as e_dq: logging.debug(f"Data queue put error: {e_dq}")
                time.sleep(0.001)
            except Exception as e:
                logging.error(f"串口读取错误: {e}")
                break
    
    def processing_loop(self):
        temp_data_buffer = None
        
        while self.running and self.processor_initialized:
            try:
                now = time.time()
                
                try:
                    while not self.data_queue.empty():
                        temp_data_buffer = self.data_queue.get_nowait() # Only frame_data is in this queue now
                except queue.Empty:
                    pass # No new data, will use previously buffered if available
                
                if temp_data_buffer is not None:
                    current_frame_data = temp_data_buffer
                    temp_data_buffer = None # Consume the buffer

                    algo_gui_params = self.get_algo_params() # Get params from GUI

                    inputs_for_algo = {
                        'frame_data': current_frame_data,  # 统一命名：frameData → frame_data
                        **algo_gui_params # 包含所有18个参数
                    }
                    
                    result_dict = ncz.step(inputs_for_algo) # Pass the dictionary
                    log_ts = now  # time.time() at the start of processing this frame
                    log_rate = result_dict.get('rate', -1.0) 
                    log_runtime = result_dict.get('runtime', -1.0)
                    log_alarm = result_dict.get('merged_alarm', -1.0)
                    logging.info(f"RAW_RUNTIME_TRACE: ts={log_ts:.3f}, rate={log_rate:.1f}, runtime={log_runtime:.1f}, alarm={log_alarm:.1f}")
                    
                    # Process and queue matrix_origin data
                    matrix_origin_raw = result_dict.get('matrix_origin')
                    if matrix_origin_raw is not None and isinstance(matrix_origin_raw, np.ndarray) and matrix_origin_raw.size == 1024:
                        try:
                            matrix_origin_reshaped = matrix_origin_raw.reshape(32, 32).T # Reshape and Transpose
                            if self.matrix_origin_queue.full(): self.matrix_origin_queue.get_nowait()
                            self.matrix_origin_queue.put_nowait(matrix_origin_reshaped)
                        except queue.Full: pass
                        except Exception as e_moq: logging.debug(f"Matrix origin queue put error: {e_moq}")
                    
                    # Process and queue matrix_filter data
                    matrix_filter_raw = result_dict.get('matrix_filter')
                    if matrix_filter_raw is not None and isinstance(matrix_filter_raw, np.ndarray) and matrix_filter_raw.size == 1024:
                        try:
                            matrix_filter_reshaped = matrix_filter_raw.reshape(32, 32).T # Reshape and Transpose
                            if self.matrix_filter_queue.full(): self.matrix_filter_queue.get_nowait()
                            self.matrix_filter_queue.put_nowait(matrix_filter_reshaped)
                        except queue.Full: pass
                        except Exception as e_mfq: logging.debug(f"Matrix filter queue put error: {e_mfq}")

                    # Process and queue body_movement_data - 架构变更：24维数组→1维标量+前端缓冲
                    current_rate = result_dict.get('rate', -1)
                    if current_rate != -1:  # Only update body movement data when real-time data is valid
                        body_movement_scalar = result_dict.get('body_movement_data', 0.0)
                        # 追加新值到历史（deque自动移除最旧的）
                        self.body_movement_history.append(float(body_movement_scalar))
                        # 转换为24维数组用于显示
                        body_movement_array = np.array(self.body_movement_history, dtype=np.float32)
                        try:
                            if self.body_movement_queue.full():
                                self.body_movement_queue.get_nowait()
                            self.body_movement_queue.put_nowait(body_movement_array.copy())
                        except queue.Full:
                            pass
                        except Exception as e_bmq:
                            logging.debug(f"Body movement queue put error: {e_bmq}")

                    self.frame_counter += 1
                    self.frame_times.append(now)
                    if len(self.frame_times) >= 2:
                        elapsed = self.frame_times[-1] - self.frame_times[0]
                        if elapsed > 0: self.current_fps = (len(self.frame_times) - 1) / elapsed
                    
                    try:
                        if self.result_queue.full(): self.result_queue.get_nowait()
                        # Result queue now gets the full dict, and frame counter
                        self.result_queue.put_nowait((result_dict, self.frame_counter)) 
                    except queue.Full: pass
                    except Exception as e_rq: logging.debug(f"Result queue put error: {e_rq}")

                sleep_time = 0.001
                time.sleep(sleep_time)
            except Exception as e:
                logging.error(f"处理错误: {e}")
                break
    
    def update_heatmap(self):
        try:
            if not self.heatmap_queue.empty():
                matrix_data = self.heatmap_queue.get_nowait()
                self.heatmap.set_data(matrix_data)
                
                # 保存最新的热力图数据，用于SOS报警窗口
                self.latest_heatmap_data = matrix_data.copy()
                
                self.heatmap_scale_update_counter += 1
                if self.heatmap_scale_update_counter % 10 == 0: # Update color scale less frequently
                    min_val, max_val = np.min(matrix_data), np.max(matrix_data)
                    if max_val > min_val: self.heatmap.set_clim(vmin=min_val, vmax=max_val)
                self.heatmap_canvas.draw_idle()
                self.heatmap_last_update_time = time.time()
        except queue.Empty: pass # No new heatmap data
        except Exception as e: logging.error(f"热力图更新错误: {e}")
        
        if self.running:
            self.heatmap_timer_id = self.root.after(30, self.update_heatmap) # ~33fps for heatmap
    
    def update_matrix_origin_heatmap(self):
        try:
            if not self.matrix_origin_queue.empty():
                matrix_data = self.matrix_origin_queue.get_nowait()
                self.matrix_origin_heatmap.set_data(matrix_data)
                min_val, max_val = np.min(matrix_data), np.max(matrix_data)
                if max_val > min_val: 
                    self.matrix_origin_heatmap.set_clim(vmin=min_val, vmax=max_val)
                else: # Handle case where all values are the same (e.g., all zeros)
                    self.matrix_origin_heatmap.set_clim(vmin=min_val -1, vmax=max_val + 1 if max_val > 0 else 1) # Avoid vmin=vmax
                self.matrix_origin_canvas.draw_idle()
        except queue.Empty: pass
        except Exception as e: logging.error(f"原始矩阵热力图更新错误: {e}")
        
        if self.running:
            self.matrix_origin_timer_id = self.root.after(35, self.update_matrix_origin_heatmap)

    def update_matrix_filter_heatmap(self):
        try:
            if not self.matrix_filter_queue.empty():
                matrix_data = self.matrix_filter_queue.get_nowait()
                self.matrix_filter_heatmap.set_data(matrix_data)
                min_val, max_val = np.min(matrix_data), np.max(matrix_data)
                if max_val > min_val:
                    self.matrix_filter_heatmap.set_clim(vmin=min_val, vmax=max_val)
                else: # Handle case where all values are the same
                    self.matrix_filter_heatmap.set_clim(vmin=min_val -1, vmax=max_val + 1 if max_val > 0 else 1)
                self.matrix_filter_canvas.draw_idle()
        except queue.Empty: pass
        except Exception as e: logging.error(f"滤波矩阵热力图更新错误: {e}")

        if self.running:
            self.matrix_filter_timer_id = self.root.after(40, self.update_matrix_filter_heatmap)

    def update_body_movement_plot(self):
        try:
            if not self.body_movement_queue.empty():
                body_movement_data = self.body_movement_queue.get_nowait()
                
                # 直接更新24个柱状图的高度
                for i in range(24):
                    height = float(body_movement_data[i])
                    # 确保数值在0-10范围内显示
                    height = max(0, min(10, height))
                    self.body_movement_bars[i].set_height(height)
                
                self.body_movement_canvas.draw_idle()
        except queue.Empty: 
            pass
        except Exception as e: 
            logging.error(f"体动数据柱状图更新错误: {e}")
        
        if self.running:
            self.body_movement_timer_id = self.root.after(50, self.update_body_movement_plot)

    def update_ui(self):
        start_ui_update_time = time.time()
              
        latest_result_dict = None
        current_frame_count = self.frame_counter # Use the main frame counter

        # Get the latest result from the queue
        try:
            while not self.result_queue.empty(): # Process all items to get the latest
                latest_result_dict, current_frame_count = self.result_queue.get_nowait()
        except queue.Empty:
            pass # No new results this cycle

        if latest_result_dict:
            # Update General Data always if result is available
            # self.status_labels["runtime"].config(text=f"{latest_result_dict.get('runtime', 0.0):.2f}") # Removed from here
            
            version_info_arr = latest_result_dict.get('version_info', [])
            if len(version_info_arr) > 0:
                ver_str = ".".join([f"{int(v)}" for v in version_info_arr])
                self.status_labels["version_info"].config(text=ver_str)
            else:
                self.status_labels["version_info"].config(text="--")

            # Update Real-time Data if rate is valid
            if latest_result_dict.get('rate', -1) != -1:
                # 记录呼吸率日志
                rate_value = latest_result_dict.get('rate', -1)
                if rate_value != -1:
                    current_time = time.time()
                    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(current_time))
                    runtime = latest_result_dict.get('runtime', 0.0)
                    
                    log_entry = {
                        'timestamp': timestamp,
                        'rate': rate_value,
                        'runtime': runtime
                    }
                    
                    with self.rate_log_lock:
                        self.rate_log.append(log_entry)
                    
                    # 增加未保存计数
                    self.unsaved_count += 1
                    
                    # 更新日志计数显示
                    self.update_rate_log_count_label()
                    
                    # 检查是否需要触发自动保存
                    self.check_auto_save_triggers()

                rt_keys = ["rate", "stroke_risk", "state_in_bed", "onbed_ratio",
                           "sos_flag", "merged_alarm", "current_threshold",
                           "on_bed_duration_minutes", "sitting_alarm_duration_minutes",
                           "body_movement_flag", "runtime"]
                for key in rt_keys:
                    if key in self.status_labels and key in latest_result_dict:
                        self.status_labels[key].config(text=f"{latest_result_dict[key]:.2f}")

                # Update alarm counter labels
                alarm_counter_data = latest_result_dict.get('alarm_counter')
                if alarm_counter_data is not None and len(alarm_counter_data) == 4:
                    self.status_labels["leave_bed_alarms"].config(text=str(int(alarm_counter_data[0])))
                    self.status_labels["sit_edge_alarms"].config(text=str(int(alarm_counter_data[1])))
                    self.status_labels["fall_bed_alarms"].config(text=str(int(alarm_counter_data[2])))
                    self.status_labels["sos_alarms"].config(text=str(int(alarm_counter_data[3])))

                # Update array type outputs (advanced parameters)
                array_outputs = ['merged_switch', 'filter_param', 'sos_param', 'sitting_area_out']
                for key in array_outputs:
                    if key in self.status_labels and key in latest_result_dict:
                        arr = latest_result_dict[key]
                        if isinstance(arr, np.ndarray) and len(arr) > 0:
                            if len(arr) <= 8:
                                # ≤8个元素：完整显示
                                display_str = ", ".join([f"{int(v)}" for v in arr])
                                # 移除tooltip（如果之前有）
                                if key in self.array_tooltips:
                                    del self.array_tooltips[key]
                            else:
                                # >8个元素：显示前8个 + 悬停提示
                                display_str = ", ".join([f"{int(v)}" for v in arr[:8]]) + "..."
                                # 创建完整数组的tooltip文本
                                full_array_str = ", ".join([f"{int(v)}" for v in arr])
                                tooltip_text = f"完整数组 ({len(arr)}个元素):\n{full_array_str}"

                                # 创建或更新tooltip
                                if key not in self.array_tooltips:
                                    self.array_tooltips[key] = ToolTip(self.status_labels[key], tooltip_text)
                                else:
                                    self.array_tooltips[key].text = tooltip_text

                            self.status_labels[key].config(text=display_str)

                # Update reserved_bytes 前3位显示
                reserved_bytes_arr = latest_result_dict.get('reserved_bytes')
                if reserved_bytes_arr is not None and isinstance(reserved_bytes_arr, np.ndarray) and len(reserved_bytes_arr) >= 3:
                    reserved_display = ", ".join([f"{int(reserved_bytes_arr[i])}" for i in range(3)])
                    if "reserved_bytes_0_2" in self.status_labels:
                        self.status_labels["reserved_bytes_0_2"].config(text=reserved_display)

                # --- REVISED ALARM LOGIC START ---
                state_in_bed_raw = latest_result_dict.get('state_in_bed', -1)
                merged_alarm_raw = latest_result_dict.get('merged_alarm', -1)

                state_in_bed_raw = int(state_in_bed_raw) if isinstance(state_in_bed_raw, (float, np.float32, np.float64)) else state_in_bed_raw
                merged_alarm_raw = int(merged_alarm_raw) if isinstance(merged_alarm_raw, (float, np.float32, np.float64)) else merged_alarm_raw

                state_in_bed_text = self.STATE_IN_BED_MAP.get(state_in_bed_raw, f"未知状态 ({state_in_bed_raw})")
                merged_alarm_text = self.MERGED_ALARM_MAP.get(merged_alarm_raw, f"未知报警 ({merged_alarm_raw})")

                self.current_status_var.set(f"当前状态: {state_in_bed_text}")
                self.current_alarm_var.set(f"当前报警: {merged_alarm_text}")

                if merged_alarm_raw != 0: # An alarm is active
                    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
                    alarm_entry = f"{timestamp} - {merged_alarm_text}"
                    
                    # Always record to history
                    self.alarm_history.appendleft(alarm_entry) 
                    self.alarm_history_listbox.delete(0, tk.END) 
                    for item in self.alarm_history:
                        self.alarm_history_listbox.insert(tk.END, item)

                    # Add detailed logging for the alarm
                    logging.info(f"ALARM DETECTED: Code={merged_alarm_raw}, Text='{merged_alarm_text}', StateInBedRaw={state_in_bed_raw}, StateInBedText='{state_in_bed_text}', Timestamp='{timestamp}'")
                    
                    # Show messagebox only if the alarm code has changed
                    if merged_alarm_raw != self.last_alarm_code_displayed:
                        # messagebox.showwarning("系统报警", f"新报警: {merged_alarm_text}\n时间: {timestamp}")
                        self.root.after(0, lambda: messagebox.showwarning("系统报警", f"新报警: {merged_alarm_text}\n时间: {timestamp}"))
                        self.last_alarm_code_displayed = merged_alarm_raw
                else: # No alarm is active (merged_alarm_raw == 0)
                    self.last_alarm_code_displayed = 0 # Reset the last displayed alarm code
                # --- REVISED ALARM LOGIC END ---

                # --- SOS ALARM HANDLING START ---
                sos_flag = latest_result_dict.get('sos_flag', 0)
                if sos_flag > 0:  # 有SOS报警（无论是新序列还是继续序列）
                    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

                    # 更新可视化所需的数据
                    self.last_sos_signal = latest_result_dict.get('sos_signal_out', np.zeros(159))
                    self.last_sos_coord = np.array(latest_result_dict.get('sos_coord', [1, 1]))

                    if sos_flag == 1:  # 新报警序列起点
                        self.current_sos_sequence = 1
                        sos_alarm_entry = f"{timestamp} - SOS紧急报警 [序列起点] (详情见弹窗)"

                        # 记录到历史列表
                        self.alarm_history.appendleft(sos_alarm_entry)
                        self.alarm_history_listbox.delete(0, tk.END)
                        for item in self.alarm_history:
                            self.alarm_history_listbox.insert(tk.END, item)

                        # 显示SOS报警可视化窗口（新序列）
                        self.root.after(0, self.show_sos_visualization)

                        # 记录日志
                        logging.info(f"SOS ALARM TRIGGERED [NEW SEQUENCE]: Timestamp='{timestamp}', sos_flag={sos_flag}")

                    elif sos_flag > 1:  # 同一序列的后续点
                        self.current_sos_sequence = sos_flag
                        # 如果窗口已存在，更新窗口
                        if self.sos_window and self.sos_window.winfo_exists():
                            self.root.after(0, lambda sf=sos_flag: self.update_sos_visualization(sf))

                        # 记录日志（不添加到历史列表，避免刷屏）
                        logging.info(f"SOS ALARM CONTINUED [SEQUENCE #{sos_flag}]: Timestamp='{timestamp}'")

                else:  # sos_flag == 0，无报警
                    if self.current_sos_sequence > 0:
                        # 序列结束
                        logging.info(f"SOS ALARM SEQUENCE ENDED: Total count was {self.current_sos_sequence}")
                        self.current_sos_sequence = 0
                # --- SOS ALARM HANDLING END ---

            else: # This is the else for "if latest_result_dict.get('rate', -1) != -1:"
                # rate is -1, so real-time data is not valid. 
                # Labels will now retain their last valid value.
                pass # Explicitly pass if no other logic is needed here for rate == -1

            # Update Minute Data if rate_minute is valid
            if latest_result_dict.get('rate_minute', -1) != -1:
                min_keys = ["rate_minute", "onbed_ratio_minute", "awake_state", "onbed_state"]
                for key in min_keys:
                    if key in self.status_labels and key in latest_result_dict:
                         self.status_labels[key].config(text=f"{latest_result_dict[key]:.2f}")

        # Update frame count (from processing loop or latest result)
        self.status_labels["处理帧数"].config(text=str(current_frame_count))
        
        # Update FPS labels
        self.fps_label.config(text=f"{self.current_fps:.1f} FPS")
        self.serial_fps_label.config(text=f"{self.serial_fps:.1f} FPS")
        
        self.ui_frame_times.append(time.time())
        if len(self.ui_frame_times) >= 2:
            ui_fps = (len(self.ui_frame_times) - 1) / (self.ui_frame_times[-1] - self.ui_frame_times[0])
            self.ui_fps_label.config(text=f"{ui_fps:.1f} FPS")
        
        # No plot updates needed here anymore

        # Dynamic UI update interval adjustment (optional, can be fixed)
        # elapsed_ui_update = time.time() - start_ui_update_time
        # update_interval = max(50, min(200, 100 + int(elapsed_ui_update * 1000))) # Between 50ms and 200ms
        update_interval = 30 # Fixed 30ms for ~33 FPS UI update

        if self.running:
            self.update_timer_id = self.root.after(update_interval, self.update_ui)
    
    def show_sos_visualization(self):
        """创建或更新SOS报警可视化窗口"""
        try:
            # 如果窗口不存在或已被销毁，则创建新窗口
            if not self.sos_window or not self.sos_window.winfo_exists():
                self.sos_window = tk.Toplevel(self.root)
                self.sos_window.title("SOS 报警详情")
                self.sos_window.geometry("800x400")

                # 创建Matplotlib图形和画布
                self.sos_fig, (self.sos_ax1, self.sos_ax2) = plt.subplots(1, 2, figsize=(8, 4), dpi=100)
                self.sos_canvas = FigureCanvasTkAgg(self.sos_fig, master=self.sos_window)
                self.sos_canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)

                # 左侧子图：热力图背景和SOS区域
                self.sos_heatmap_img = self.sos_ax1.imshow(self.latest_heatmap_data, cmap='viridis', interpolation='nearest')
                self.sos_ax1.set_xticks([])
                self.sos_ax1.set_yticks([])
                self.sos_hRect = matplotlib.patches.Rectangle((0, 0), 8, 4, linewidth=2, edgecolor='r', facecolor='none', visible=False)
                self.sos_ax1.add_patch(self.sos_hRect)

                # 右侧子图：SOS信号
                self.sos_hPlot, = self.sos_ax2.plot(self.last_sos_signal)
                self.sos_ax2.set_ylim(0, 255)
                self.sos_ax2.set_xlim(0, 159)  # 更新为159
                self.sos_ax2.set_title("SOS 信号波形")

                self.sos_fig.tight_layout()
                self.sos_window.protocol("WM_DELETE_WINDOW", self.on_close_sos_window)

            # 更新数据和标题
            self.sos_ax1.set_title(f"SOS 标志 = 1 [序列起点]")
            
            # 更新热力图背景
            if self.sos_heatmap_img is not None:
                self.sos_heatmap_img.set_data(self.latest_heatmap_data)
                # 设置颜色范围
                min_val, max_val = np.min(self.latest_heatmap_data), np.max(self.latest_heatmap_data)
                if max_val > min_val:
                    self.sos_heatmap_img.set_clim(vmin=min_val, vmax=max_val)

            # 更新信号图
            self.sos_hPlot.set_ydata(self.last_sos_signal)

            # 更新矩形框位置和可见性
            if np.any(self.last_sos_coord != 1):
                # 假设坐标是1-based的[行, 列]
                row, col = self.last_sos_coord[0], self.last_sos_coord[1]
                # Matplotlib的Rectangle位置是(x, y)，即(列, 行)
                self.sos_hRect.set_xy((col - 1, row - 1))
                self.sos_hRect.set_visible(True)
            else:
                self.sos_hRect.set_visible(False)
            
            # 刷新画布并置于顶层
            self.sos_canvas.draw()
            self.sos_window.deiconify()
            self.sos_window.lift()

        except Exception as e:
            logging.error(f"显示SOS可视化时出错: {e}")

    def on_close_sos_window(self):
        """处理SOS窗口关闭事件"""
        if self.sos_window:
            self.sos_window.destroy()
            self.sos_window = None
            # 可选：重置图形对象句柄
            self.sos_fig, self.sos_canvas, self.sos_ax1, self.sos_ax2, self.sos_hRect, self.sos_hPlot = None, None, None, None, None, None
            self.sos_heatmap_img = None  # 重置热力图对象

    def update_sos_visualization(self, sos_flag):
        """更新SOS报警可视化窗口（用于同一序列的后续点）"""
        try:
            if not self.sos_window or not self.sos_window.winfo_exists():
                return

            # 更新标题显示当前序列计数
            self.sos_ax1.set_title(f"SOS 标志 = {sos_flag} [同一序列第{sos_flag}次]")

            # 更新热力图背景
            if self.sos_heatmap_img is not None:
                self.sos_heatmap_img.set_data(self.latest_heatmap_data)
                min_val, max_val = np.min(self.latest_heatmap_data), np.max(self.latest_heatmap_data)
                if max_val > min_val:
                    self.sos_heatmap_img.set_clim(vmin=min_val, vmax=max_val)

            # 更新信号图
            self.sos_hPlot.set_ydata(self.last_sos_signal)

            # 更新矩形框位置和可见性
            if np.any(self.last_sos_coord != 1):
                row, col = self.last_sos_coord[0], self.last_sos_coord[1]
                self.sos_hRect.set_xy((col - 1, row - 1))
                self.sos_hRect.set_visible(True)
            else:
                self.sos_hRect.set_visible(False)

            # 刷新画布并保持窗口置顶
            self.sos_canvas.draw()
            self.sos_window.lift()

        except Exception as e:
            logging.error(f"更新SOS可视化时出错: {e}")

    def update_rate_log_count_label(self):
        """更新呼吸率日志计数显示"""
        try:
            with self.rate_log_lock:
                count = len(self.rate_log)
            self.rate_log_count_label.config(text=f"{count}条")
            
            # 更新未保存计数显示
            if self.unsaved_count > 0:
                self.unsaved_count_label.config(text=f"待保存: {self.unsaved_count}条", foreground="orange")
            else:
                self.unsaved_count_label.config(text="已保存", foreground="green")
        except Exception as e:
            logging.error(f"更新日志计数显示时出错: {e}")

    def export_rate_log_to_csv(self):
        """导出呼吸率日志到CSV文件"""
        try:
            with self.rate_log_lock:
                if len(self.rate_log) == 0:
                    messagebox.showwarning("导出警告", "没有呼吸率日志数据可以导出")
                    return
                
                # 复制数据以避免长时间持有锁
                log_data = list(self.rate_log)
            
            # 生成默认文件名
            current_time = time.strftime("%Y%m%d_%H%M%S", time.localtime())
            default_filename = f"呼吸率日志_{current_time}.csv"
            
            # 打开文件保存对话框
            file_path = filedialog.asksaveasfilename(
                title="保存呼吸率日志",
                defaultextension=".csv",
                filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")],
                initialfile=default_filename
            )
            
            if not file_path:
                return  # 用户取消了操作
            
            # 写入CSV文件
            with open(file_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                fieldnames = ['时间戳', '呼吸率', '运行时间戳']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                # 写入表头
                writer.writeheader()
                
                # 写入数据
                for entry in log_data:
                    writer.writerow({
                        '时间戳': entry['timestamp'],
                        '呼吸率': f"{entry['rate']:.2f}",
                        '运行时间戳': f"{entry['runtime']:.2f}"
                    })
            
            messagebox.showinfo("导出成功", f"呼吸率日志已成功导出到:\n{file_path}\n\n共导出 {len(log_data)} 条记录")
            logging.info(f"呼吸率日志导出成功: {file_path}, 共 {len(log_data)} 条记录")
            
        except PermissionError:
            messagebox.showerror("导出错误", "文件保存失败：没有写入权限或文件正在被其他程序使用")
        except Exception as e:
            messagebox.showerror("导出错误", f"导出过程中发生错误:\n{str(e)}")
            logging.error(f"导出呼吸率日志时出错: {e}")

    def clear_rate_log(self):
        """清空呼吸率日志"""
        try:
            result = messagebox.askyesno("确认清空", "确定要清空所有呼吸率日志记录吗？\n此操作不可撤销。")
            if result:
                with self.rate_log_lock:
                    self.rate_log.clear()
                
                # 重置未保存计数
                self.unsaved_count = 0
                self.last_save_time = time.time()
                
                self.update_rate_log_count_label()
                messagebox.showinfo("清空完成", "呼吸率日志已清空")
                logging.info("呼吸率日志已手动清空")
        except Exception as e:
            messagebox.showerror("清空错误", f"清空日志时发生错误:\n{str(e)}")
            logging.error(f"清空呼吸率日志时出错: {e}")

    def create_logs_directory(self):
        """创建日志文件目录"""
        try:
            if not os.path.exists(self.logs_directory):
                os.makedirs(self.logs_directory)
                logging.info(f"创建日志目录: {self.logs_directory}")
        except Exception as e:
            logging.error(f"创建日志目录失败: {e}")
            messagebox.showerror("目录创建错误", f"无法创建日志目录:\n{str(e)}")

    def get_today_log_filename(self):
        """生成当天的日志文件路径"""
        today = time.strftime("%Y%m%d", time.localtime())
        filename = f"呼吸率日志_{today}.csv"
        return os.path.join(self.logs_directory, filename)

    def load_local_rate_log(self):
        """从本地文件加载当天的历史数据"""
        try:
            log_file_path = self.get_today_log_filename()
            if not os.path.exists(log_file_path):
                logging.info(f"当天日志文件不存在，从空白开始: {log_file_path}")
                return

            loaded_count = 0
            with open(log_file_path, 'r', encoding='utf-8-sig') as csvfile:
                reader = csv.DictReader(csvfile)
                with self.rate_log_lock:
                    for row in reader:
                        try:
                            log_entry = {
                                'timestamp': row['时间戳'],
                                'rate': float(row['呼吸率']),
                                'runtime': float(row['运行时间戳'])
                            }
                            # 检查是否已存在相同时间戳的记录（去重）
                            existing = any(entry['timestamp'] == log_entry['timestamp'] for entry in self.rate_log)
                            if not existing:
                                self.rate_log.append(log_entry)
                                loaded_count += 1
                        except (ValueError, KeyError) as e:
                            logging.warning(f"跳过无效的日志行: {row}, 错误: {e}")
                            continue

            logging.info(f"从本地文件加载了 {loaded_count} 条呼吸率记录: {log_file_path}")
            # 重置未保存计数，因为这些数据已经在文件中
            self.unsaved_count = 0
            
        except Exception as e:
            logging.error(f"加载本地日志文件失败: {e}")
            messagebox.showerror("数据加载错误", f"无法加载历史数据:\n{str(e)}")

    def save_rate_log_to_local(self):
        """保存呼吸率日志到本地文件"""
        if self.unsaved_count == 0:
            return  # 没有未保存的数据
        
        try:
            log_file_path = self.get_today_log_filename()
            file_exists = os.path.exists(log_file_path)
            
            # 获取需要保存的新数据（最后unsaved_count条记录）
            with self.rate_log_lock:
                if self.unsaved_count > len(self.rate_log):
                    # 防止计数错误导致越界
                    new_data = list(self.rate_log)
                else:
                    new_data = list(self.rate_log)[-self.unsaved_count:]
            
            # 追加模式写入文件
            with open(log_file_path, 'a', newline='', encoding='utf-8-sig') as csvfile:
                fieldnames = ['时间戳', '呼吸率', '运行时间戳']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                # 如果文件不存在或为空，写入表头
                if not file_exists or os.path.getsize(log_file_path) == 0:
                    writer.writeheader()
                
                # 写入新数据
                for entry in new_data:
                    writer.writerow({
                        '时间戳': entry['timestamp'],
                        '呼吸率': f"{entry['rate']:.2f}",
                        '运行时间戳': f"{entry['runtime']:.2f}"
                    })
            
            # 更新保存状态
            saved_count = self.unsaved_count
            self.unsaved_count = 0
            self.last_save_time = time.time()
            
            logging.info(f"成功保存 {saved_count} 条呼吸率记录到本地文件: {log_file_path}")
            
            # 更新UI显示
            self.update_rate_log_count_label()
            
        except Exception as e:
            logging.error(f"保存本地日志文件失败: {e}")
            messagebox.showerror("数据保存错误", f"无法保存数据到本地文件:\n{str(e)}")

    def check_auto_save_triggers(self):
        """检查是否满足自动保存触发条件"""
        current_time = time.time()
        time_since_last_save = current_time - self.last_save_time
        
        # 检查触发条件：记录数达到阈值 OR 时间超过阈值
        if (self.unsaved_count >= self.save_threshold_count or 
            time_since_last_save >= self.save_threshold_time):
            
            # 使用after方法异步执行保存，避免阻塞UI
            if not self.auto_save_timer_id:  # 防止重复触发
                self.auto_save_timer_id = self.root.after(100, self.perform_auto_save)

    def perform_auto_save(self):
        """执行自动保存"""
        try:
            self.save_rate_log_to_local()
            self.auto_save_timer_id = None  # 重置定时器ID
        except Exception as e:
            logging.error(f"自动保存失败: {e}")
            self.auto_save_timer_id = None

    def manual_save_rate_log(self):
        """手动保存呼吸率日志"""
        try:
            if self.unsaved_count == 0:
                messagebox.showinfo("保存提示", "当前没有需要保存的新数据")
                return
            
            old_count = self.unsaved_count
            self.save_rate_log_to_local()
            messagebox.showinfo("保存成功", f"成功保存 {old_count} 条呼吸率记录到本地文件")
            
        except Exception as e:
            messagebox.showerror("保存错误", f"手动保存失败:\n{str(e)}")
            logging.error(f"手动保存呼吸率日志失败: {e}")

    def on_closing(self):
        # 程序关闭前强制保存未保存的数据
        if self.unsaved_count > 0:
            try:
                self.save_rate_log_to_local()
                logging.info(f"程序关闭前保存了 {self.unsaved_count} 条未保存的呼吸率记录")
            except Exception as e:
                logging.error(f"程序关闭时保存数据失败: {e}")
        
        # 取消自动保存定时器
        if self.auto_save_timer_id:
            self.root.after_cancel(self.auto_save_timer_id)
            self.auto_save_timer_id = None
        
        if self.running:
            self.stop_monitoring()
        if self.processor_initialized:
            ncz.terminate()
            logging.info("算法包已终止")
        self.root.destroy()
    
    def run(self):
        self.root.mainloop()

def main():
    monitor = SerialMonitor()
    monitor.run()

if __name__ == "__main__":
    main() 