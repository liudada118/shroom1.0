import React from 'react'
import './chart.scss'


const chartArr = [
  [3, 5],
  [2, 7], [4, 6], [6, 2], [3, 5], [6, 4], [0, 9], [6, 4], [6, 2], [4, 2], [2, 4], [4, 2], [2, 7], [1, 9]
]

export function Chart1() {
  return (
    <div className='chart'>
      {chartArr.map((a, indexs) => {
        return (
          <div className='chartItems'>
            {a.map((b, index) => {
              return <div className='chartItem' style={{ height: `${b * 5}px`, backgroundColor: index === 0 ? '#01F1E3' : '#991BFA', marginBottom: index === 0 ? 5 : 0 }}></div>
            })}
          </div>
        )
      })}
    </div>
  )
}

export function Chart2() {
  return (
    <div className='chart'>
      <div className='chartLeft'></div>
      <div className='chartRight'></div>
    </div>
  )
}

const dataArr1 = [
  {
    color: '#2A99FF',
    data: '足弓分类',
  }, {
    color: '#FF2A2A',
    data: '脚长',
  }
]
const footArr = ['footType', 'footLength']

var ele, context

export class CanvasDemo extends React.Component {
  constructor(props) {
    super()
    this.state = {
      total: 0,
      leftValue: 0,
      rightValue: 0,
      leftProp: 0,
      rightProp: 0,
      footType: '正常',
      footLength: 0
    }
    this.initCanvasrotate = this.initCanvasrotate.bind(this)
    this.initCanvasrotate1 = this.initCanvasrotate1.bind(this)
    this.changeState = this.changeState.bind(this)
  }

  // initCanvas() {
  //   const {
  //     x0,//原点坐标
  //     y0,
  //     r,// 半径
  //     lineWidth, // 画笔宽度
  //     strokeStyle, //画笔颜色
  //     LinearGradientColor1, //起始渐变颜色
  //     LinearGradientColor2, //结束渐变颜色
  //     Percentage,// 进度百分比
  //   } = this.props
  //   const divWidth = document.querySelector('.canvasContent').getBoundingClientRect().width
  //   // console.log(divWidth)
  //   let ele = document.getElementById("time_graph_canvas")
  //   let context = ele.getContext("2d");
  //   //创建背景圆
  //   var x = 20; // 圆角矩形左上角横坐标
  //   var y = 20; // 圆角矩形左上角纵坐标
  //   var width = 250; // 圆角矩形的宽度
  //   var height = 250; // 圆角矩形的高度
  //   var radius = (divWidth - 40) / 2; // 圆角的半径
  //   context.width = divWidth
  //   // 开始创建新路径
  //   const linesWidth = 10
  //   context.lineWidth = `${linesWidth}`;
  //   context.beginPath();
  //   // 绘制左上角圆角
  //   context.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 8 / 6);
  //   // 绘制顶边路径
  //   context.strokeStyle = '#991BFA';
  //   context.stroke();



  //   context.lineWidth = `${linesWidth}`;
  //   context.beginPath();
  //   // 绘制左上角圆角
  //   context.arc(x + radius, y + radius, radius, Math.PI * 17 / 12, Math.PI * 2);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#01F1E3';
  //   context.stroke();



  //   context.beginPath();
  //   context.lineWidth = `${linesWidth / 2}`;
  //   // 绘制左上角圆角
  //   context.arc(x + linesWidth / 2 + radius * 2 - 10 + 5, y + radius, 2.5, 0, Math.PI);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#01F1E3';
  //   context.stroke();

  //   context.beginPath();
  //   // 绘制左上角圆角
  //   context.arc(x + linesWidth / 2 - 10 + 5, y + radius, 2.5, 0, Math.PI);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#991BFA';
  //   context.stroke();


  //   context.beginPath();
  //   // 绘制左上角圆角
  //   context.arc(x + radius * (1 - Math.sin(Math.PI / 6)), y + radius * (1 - Math.cos(Math.PI / 6)), 2.5, Math.PI * 4 / 3, Math.PI / 3);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#991BFA';
  //   context.stroke();

  //   context.beginPath();
  //   // 绘制左上角圆角
  //   context.arc(x + radius * (1 + Math.cos((Math.PI * 17 / 12))), y + radius * (1 - Math.sin((Math.PI * 5 / 12))), 2.5, Math.PI + Math.PI * 17 / 12, Math.PI * 17 / 12);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#01F1E3';
  //   context.stroke();


  // }

  // initCanvas1() {
  //   const {
  //     x0,//原点坐标
  //     y0,
  //     r,// 半径
  //     lineWidth, // 画笔宽度
  //     strokeStyle, //画笔颜色
  //     LinearGradientColor1, //起始渐变颜色
  //     LinearGradientColor2, //结束渐变颜色
  //     Percentage,// 进度百分比
  //   } = this.props
  //   const divWidth = document.querySelector('.canvasContent').getBoundingClientRect().width
  //   // console.log(divWidth)
  //   let ele = document.getElementById("time_graph_canvas")
  //   let context = ele.getContext("2d");
  //   //创建背景圆
  //   var x = 20; // 圆角矩形左上角横坐标
  //   var y = 20; // 圆角矩形左上角纵坐标
  //   var width = 250; // 圆角矩形的宽度
  //   var height = 250; // 圆角矩形的高度
  //   var radius = (divWidth - 40) / 2; // 圆角的半径
  //   context.width = divWidth
  //   // 开始创建新路径
  //   const linesWidth = 10
  //   context.save();
  //   context.translate(x + radius, y + radius)
  //   context.rotate(0 / 6 * Math.PI);
  //   context.lineWidth = `${linesWidth}`;
  //   context.beginPath();
  //   context.arc(x + radius, y + radius, radius, Math.PI * 13 / 24, Math.PI * 35 / 24);
  //   context.strokeStyle = '#991BFA';
  //   context.stroke();

  //   context.lineWidth = `${linesWidth}`;
  //   context.beginPath();
  //   context.arc(x + radius, y + radius, radius, Math.PI * 37 / 24, Math.PI * 11 / 24);
  //   context.strokeStyle = '#01F1E3';
  //   context.stroke();



  //   context.lineWidth = `${linesWidth / 2}`;
  //   context.beginPath();
  //   context.arc(x + linesWidth / 2 - 10 + 5, y + radius, 2.5, 0, Math.PI);
  //   context.strokeStyle = '#991BFA';
  //   context.stroke();

  //   context.beginPath();
  //   context.arc(x + radius * (1 - Math.sin(Math.PI * 1 / 24)), y + radius * (1 - Math.cos(Math.PI * 1 / 24)), 2.5, Math.PI * 35 / 24, Math.PI * 11 / 24);
  //   context.strokeStyle = '#991BFA';
  //   context.stroke();


  //   context.beginPath();
  //   // 绘制左上角圆角
  //   context.arc(x + radius * (1 + Math.sin(Math.PI * 1 / 24)), y + radius * (1 - Math.cos(Math.PI * 1 / 24)), 2.5, Math.PI * 13 / 24, Math.PI * 37 / 24);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#01F1E3';
  //   context.stroke();

  //   context.clearRect(0, 115, divWidth, 260);


  //   context.beginPath();
  //   context.lineWidth = `${linesWidth / 2}`;
  //   // 绘制左上角圆角
  //   context.arc(x + linesWidth / 2 + radius * 2 - 10 + 5, y + radius, 2.5, 0, Math.PI);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#01F1E3';
  //   context.stroke();

  //   context.beginPath();
  //   // 绘制左上角圆角
  //   context.arc(x + linesWidth / 2 - 10 + 5, y + radius, 2.5, 0, Math.PI);
  //   // 绘制右上角圆角

  //   // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // context.closePath();
  //   // 设置绘制的颜色
  //   context.strokeStyle = '#991BFA';
  //   context.stroke();

  //   // context.beginPath();
  //   // // 绘制左上角圆角
  //   // context.arc(x + radius * (1 + Math.cos((Math.PI * 17 / 12))), y + radius * (1 - Math.sin((Math.PI * 5 / 12))), 2.5, Math.PI + Math.PI * 17 / 12, Math.PI * 17 / 12);
  //   // // 绘制右上角圆角

  //   // // 闭合路径 也可使用 context.lineTo(x, y + radius);
  //   // // context.closePath();
  //   // // 设置绘制的颜色
  //   // context.strokeStyle = '#01F1E3';
  //   // context.stroke();


  // }

  initCanvasrotate(rotate) {
    // console.log(rotate)
    // context.clearRect(-260, -260, 260, 260);

    context.clearRect(0, 0, ele.width, ele.height);
    const divWidth = document.querySelector('.canvasContent').getBoundingClientRect().width
    // console.log(divWidth)

    //创建背景圆
    var x = 20; // 圆角矩形左上角横坐标
    var y = 20; // 圆角矩形左上角纵坐标
    var width = 250; // 圆角矩形的宽度
    var height = 250; // 圆角矩形的高度
    var radius = (divWidth - 40) / 2; // 圆角的半径
    context.width = divWidth
    // 开始创建新路径
    const linesWidth = 10
    context.save();
    context.translate(x + radius, y + radius)
    context.rotate(rotate * Math.PI);

    // 左右两半圆
    context.lineWidth = `${linesWidth}`;
    context.beginPath();
    context.arc(0, 0, radius, Math.PI * 13 / 24, Math.PI * 35 / 24);
    context.strokeStyle = '#991BFA';
    context.stroke();

    context.lineWidth = `${linesWidth}`;
    context.beginPath();
    context.arc(0, 0, radius, Math.PI * 37 / 24, Math.PI * 11 / 24);
    context.strokeStyle = '#01F1E3';
    context.stroke();

    // 左右两半圆的圆角
    context.lineWidth = `${linesWidth / 2}`;
    context.beginPath();
    context.arc(radius * (0 - Math.sin(Math.PI * 1 / 24)), radius * (0 - Math.cos(Math.PI * 1 / 24)), 2.5, Math.PI * 35 / 24, Math.PI * 11 / 24);
    context.strokeStyle = '#991BFA';
    context.stroke();

    context.beginPath();
    context.arc(radius * (0 + Math.sin(Math.PI * 1 / 24)), radius * (0 - Math.cos(Math.PI * 1 / 24)), 2.5, Math.PI * 13 / 24, Math.PI * 37 / 24);
    context.strokeStyle = '#01F1E3';
    context.stroke();


    // 将下半圆清除
    context.rotate(-rotate * Math.PI);
    context.clearRect(-radius - linesWidth, 0, 260, 260);

    // 左右半圆下半的圆角
    context.beginPath();
    context.lineWidth = `${linesWidth / 2}`;
    context.arc(radius, 0, 2.5, 0, Math.PI);
    context.strokeStyle = '#01F1E3';
    context.stroke();

    context.beginPath();
    context.arc(-radius, 0, 2.5, 0, Math.PI);
    context.strokeStyle = '#991BFA';
    context.stroke();

  }


  initCanvasrotate1(rotate) {
    // console.log(rotate)
    // context.clearRect(-260, -260, 260, 260);

    context.clearRect(0, 0, ele.width, ele.height);
    const divWidth = document.querySelector('.canvasContent').getBoundingClientRect().width
    // console.log(divWidth)

    //创建背景圆
    var x = 20; // 圆角矩形左上角横坐标
    var y = 20; // 圆角矩形左上角纵坐标
    var width = 250; // 圆角矩形的宽度
    var height = 250; // 圆角矩形的高度
    var radius = (divWidth - 40) / 2; // 圆角的半径
    context.width = divWidth
    // 开始创建新路径
    const linesWidth = 10
    context.save();
    context.translate(x + radius, y + radius)
    context.rotate(rotate * Math.PI);

    // 左右两半圆
    context.lineWidth = `${linesWidth}`;
    context.beginPath();
    context.arc(0, 0, radius, Math.PI * 13 / 24, Math.PI * 35 / 24);
    context.strokeStyle = '#991BFA';
    context.stroke();

    context.lineWidth = `${linesWidth}`;
    context.beginPath();
    context.arc(0, 0, radius, Math.PI * 37 / 24, Math.PI * 11 / 24);
    context.strokeStyle = '#01F1E3';
    context.stroke();

    // 左右两半圆的圆角
    context.lineWidth = `${linesWidth / 2}`;
    context.beginPath();
    context.arc(radius * (0 - Math.sin(Math.PI * 1 / 24)), radius * (0 - Math.cos(Math.PI * 1 / 24)), 2.5, Math.PI * 35 / 24, Math.PI * 11 / 24);
    context.strokeStyle = '#991BFA';
    context.stroke();

    context.beginPath();
    context.arc(radius * (0 + Math.sin(Math.PI * 1 / 24)), radius * (0 - Math.cos(Math.PI * 1 / 24)), 2.5, Math.PI * 13 / 24, Math.PI * 37 / 24);
    context.strokeStyle = '#01F1E3';
    context.stroke();


    // 将下半圆清除
    context.rotate(-rotate * Math.PI);
    context.clearRect(-radius - linesWidth, 0, 260, 260);

    // 左右半圆下半的圆角
    context.beginPath();
    context.lineWidth = `${linesWidth / 2}`;
    context.arc(radius, 0, 2.5, 0, Math.PI);
    context.strokeStyle = '#01F1E3';
    context.stroke();

    context.beginPath();
    context.arc(-radius, 0, 2.5, 0, Math.PI);
    context.strokeStyle = '#991BFA';
    context.stroke();
    context.translate(-(x + radius), -(y + radius))
  }

  changeState(obj) {
    this.setState(obj)
  }

  componentDidMount() {
    ele = document.getElementById("time_graph_canvas")
    context = ele.getContext("2d");
    this.initCanvasrotate1(-1 / 3)
  }
  componentDidUpdate() {
    // this.initCanvas()
  }
  static defaultProps = {
    canvaswidth: 200,// 画布宽度
    canvasheight: 130,// 画布高度
    x0: 80,
    y0: 80,
    r: 72,
    lineWidth: 16,
    strokeStyle: 'rgba(248, 248, 248, 1)',
    LinearGradientColor1: '#3EECED',
    LinearGradientColor2: '#499BE6'
  }
  render() {
    console.log(this.props)
    const { width, height, canvaswidth, canvasheight } = this.props
    return (
      <div style={{ width: width, height: height, padding: 10 }}>
        <div className='canvasContent'>

          <canvas id="time_graph_canvas" height={canvasheight}></canvas>
          <div style={{ position: 'absolute', left: '50%', top: '70%', transform: 'translate(-50% , -50%)', display: 'flex', flexDirection: "column", justifyContent: 'center', alignItems: 'center' }}>
            <div>Total Press</div>
            <h2 style={{ color: '#fff' }}>{this.state.total}</h2>
          </div>

        </div>
        <div className='customInfo'>
          <div className='chartCircleContentCloumn'>
            <div className='chartCircleContent'>
              <div className="chartCircle"></div>
              <div>left</div>
            </div>
            <div>{this.state.leftValue}+{this.state.leftProp}%</div>
          </div>
          <div className='chartCircleContentCloumn'>
            <div className='chartCircleContent'>
              <div className="chartCircleright"></div>
              <div>right</div>
            </div>
            <div>{this.state.rightValue}+{this.state.rightProp}%</div>
          </div>

        </div>
        <div>
          {
            dataArr1.map((a, index) => {
              return (
                <div className='dataItem' key={a.eng}>
                  <div className='dataItemCircle'>
                    <div className='circleItem' style={{ backgroundColor: a.color }}></div>
                    <div>{a.data}</div>
                  </div>
               
                    <div>{this.state[footArr[index]]} {dataArr1[index].data === '足弓分类' ? Number(this.state.footValue).toFixed(2) : null}</div>
               
                </div>
              )
            })
          }
        </div>
      </div>
    )
  }
}
