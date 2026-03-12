# antd v5 message 弹窗修复方案

## 问题
antd v5 中 `message.info()` 静态方法无法消费 context，导致弹窗不显示。

## 官方推荐方案

### 方案1: useMessage hooks (推荐，但需要函数组件)
```jsx
const [api, contextHolder] = message.useMessage();
// contextHolder 需要放在 JSX 中
// api.info('xxx') 来调用
```

### 方案2: App 组件包裹 + App.useApp
```jsx
import { App } from 'antd';
// 在 App 组件内部使用 App.useApp() 获取 message
const { message } = App.useApp();
```

### 方案3: 静态方法仍然可用，但需要配置
antd v5 的静态方法 `message.info()` 实际上仍然可以工作，
但它会通过 `ReactDOM.render` 创建独立的 React 实例。
这意味着它不能消费 ConfigProvider 的 context。

关键点：静态方法本身应该能弹出消息，只是不能消费 context。
如果完全不弹出，可能是 CSS 样式问题或 z-index 问题。

## 可能的真实原因
1. Electron 环境下 z-index 被遮挡
2. CSS 样式未正确加载
3. 消息弹出在错误的位置（被其他元素遮挡）
