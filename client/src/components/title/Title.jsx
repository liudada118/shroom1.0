import React from 'react'
import { Menu, Slider, Button, Select, message, Divider, Space, Radio, Drawer, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import exchange from '../../assets/images/exchange.png'
import option from '../../assets/images/Option.png'
import logo from '../../assets/images/logo.png'
import './title.scss'
import Input from 'antd/es/input/Input';
import { CSVLink, CSVDownload } from 'react-csv';
import { timeStampToDate, timeStampToDateNospace } from '../../assets/util/util';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { withTranslation } from "react-i18next";

import { useTranslation, initReactI18next } from "react-i18next";
import { NavLink, useNavigate } from 'react-router-dom';
let collection = JSON.parse(localStorage.getItem('collection'))
  ? JSON.parse(localStorage.getItem('collection'))
  : [['hunch', 'front', '标签']];

const maxValue = 1000

let loadData = ''

/**
 * 
 * @param {*} param0  sensorType 传感器类型 , valueType 需要修改的值的类型 , value 需要修改的值
 * 修改localStroage 里面的配置
 * 
 */
const changeLocalStroage = ({ sensorType, valueType, value }) => {
  // localStorage.setItem("carValue", value);
  console.log(valueType)
  let config = JSON.parse(localStorage.getItem('valueConfig'))
  console.log(config)
  if (!config) {
    config = {}
  }

  if (!config[sensorType]) {
    config[sensorType] = {}
  }

  config[sensorType][valueType] = value
  console.log(config)
  localStorage.setItem('valueConfig', JSON.stringify(config))
}

// const sensorArr = [
//   { label: '沃尔沃', value: 'volvo' },
//   // { label: '延峰10', value: 'yanfeng10' },
//   // { label: '脚型检测', value: 'foot' },
//   // { label: '手部检测', value: 'hand' },
//   // { label: '手部检测(蓝', value: 'handBlue' },
//   // { label: '汽车座椅', value: 'car' },
//   // { label: '床垫监测', value: 'bigBed' },
//   // { label: '汽车靠背(量产)', value: 'car10' },
//   // { label: '本地自适应', value: 'localCar' },
//   // { label: '席悦座椅', value: 'sit10' },
//   // { label: '席悦1.0', value: 'smallBed' },
//   // { label: '小床128', value: 'smallBed1' },
//   // { label: '小矩阵1', value: 'smallM' },
//   // { label: '矩阵2', value: 'rect' },
//   // { label: 'T-short', value: 'short' },
//   // { label: '唐群座椅', value: 'CarTq' },
//   // { label: '座椅采集', value: 'sitCol' },
//   // { label: '小床褥采集', value: 'matCol' },
//   // { label: '正常测试', value: 'normal' },
//   // { label: '席悦2.0', value: 'xiyueReal1' },
//   // { label: '小床监测', value: 'jqbed' },
// ]

// 展会

// const sensorArr = [
//     { label: '席悦1.0', value: 'smallBed' },
//     { label: '席悦2.0', value: 'xiyueReal1' },
//     // { label: '小床监测', value: 'jqbed' },
//     // { label: '沃尔沃', value: 'volvo' },
// ]
// React.translate = t;


// const [current, setCurrent] = useState('now');
// const [carCurrent, setCarCurrent] = useState('all');
// const [show, setShow] = useState(false)
class Title extends React.Component {
  constructor() {
    super()
    this.state = {
      current: 'now',
      carCurrent: 'all',
      show: false,
      resetZero: false,
      num: 0,
      dataTime: '',
      clickState: true,
      colName: '',
      csvData: JSON.parse(localStorage.getItem('collection'))
        ? JSON.parse(localStorage.getItem('collection'))
        : [['hunch', 'front', '标签']],
      length: JSON.parse(localStorage.getItem('collection'))
        ? JSON.parse(localStorage.getItem('collection')).length
        : 1,
      ip: localStorage.getItem('ip') ? localStorage.getItem('ip') : '',

      dataName: '',
      items: localStorage.getItem('sitType') ? JSON.parse(localStorage.getItem('sitType')) : [],
      name: '',
      items1: localStorage.getItem('sitType1') ? JSON.parse(localStorage.getItem('sitType1')) : [],
      name1: '',
      realname: '',
      realname1: '',
      loadName: '',
      open: false,
      fingerIndex: 0,
      colHZ: 12
    }
    this.inputRef = React.createRef(null)
    this.inputRef1 = React.createRef(null)
  }

  componentDidMount() {
    console.log(this.props, 'props')

    if (this.props.matrixName === 'sitCol' || this.props.matrixName === 'handBlue') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5']
        })
      }
    } else if (this.props.matrixName === 'matColPos') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['平躺_0', '左侧躺_1', '右侧躺_2', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['平躺_0', '左侧躺_1', '右侧躺_2',]
        })
      }
    }
  }


  onClick = (e) => {
    console.log('click ', e.key);
    this.props.data.current?.changeData({ meanPres: 0, maxPres: 0, point: 0, area: 0, totalPres: 0, pressure: 0 })
    if (this.props.matrixName === 'foot') { this.props.track.current?.canvasInit() }
    this.props.data.current?.initCharts()
    if (e.key === 'now') {
      // this.props.changeLocal(false)
      this.props.wsSendObj({
        local: false,
        history: false
      })
      this.props.changeStateData({ history: 'now', local: false })
    } else if (e.key === 'playback') {
      // this.props.changeLocal(true)
      this.props.wsSendObj({
        local: true,
        history: false
      })
      this.props.changeStateData({ history: 'playback', index: 0, local: true })



    } else {
      this.props.changeStateData({ history: 'history', index: 0, local: true })
      // this.props.changeLocal(true)


      if (this.state.dataTime != '') {
        this.props.wsSendObj({
          local: true,
          history: true
        })
      } else {
        this.props.wsSendObj({
          local: true,
          // history : true
        })
      }
    }
    this.setState({
      current: e.key
    })
    // setCurrent(e.key);
  };

  onCarClick = (e) => {
    if (this.state.clickState) {
      if (e.key === 'sit') {
        this.setState({
          carCurrent: 'sit',
          clickState: false
        })

        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionSit()
        this.props.changeStateData({ carState: 'sit' })
      } else if (e.key === 'back') {
        this.setState({
          carCurrent: 'back',
          clickState: false
        })
        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionBack()
        this.props.changeStateData({ carState: 'back' })
      } else if (e.key === 'head') {
        this.setState({
          carCurrent: 'head',
          clickState: false
        })
        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionHead()
        this.props.changeStateData({ carState: 'head' })
      } else {
        this.setState({
          carCurrent: 'all',
          clickState: false
        })
        if (this.props.numMatrixFlag == 'normal') this.props.com.current?.actionAll()
        this.props.changeStateData({ carState: 'all' })
        this.props.changeStateData({ numMatrixFlag: 'normal' })
      }
    }

    setTimeout(() => {
      this.setState({
        clickState: true
      })
    }, 1000);
  }

  changeNum = (num) => {
    this.setState({
      num: num
    })
  }

  onChange = (value) => {
    // this.props.changeStateData({ dataName: })
    this.setState({ realname: value })
    this.setState({ colName: value + this.state.realname1 })
  };

  onSearch = (value) => {
    console.log('search:', value);
  };

  filterOption = (input, option) =>
    (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
  changeMatrixType(e) {
    // this.props.handleChangeCom(e);
    console.log(e);
    this.props.wsSendObj({ file: e })
    this.props.changeMatrix(e)
    if (e === 'bigBed') {
      this.props.initBigCtx()
    } else if (e === 'sitCol') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['正常_1', '脊柱侧弯_2', '前倾_3', '驼背_4', '二郎腿_5']
        })
      }
    } else if (e === 'matCol') {
      if (localStorage.getItem('sitType1')) {
        console.log('localSetState')
        this.setState({
          items1: ['其他_1', '平躺_2', '侧睡_3', '趴睡_4', '其他_5', ...JSON.parse(localStorage.getItem('sitType1'))]
        })
      } else {
        console.log('setState')
        this.setState({
          items1: ['其他_1', '平躺_2', '侧睡_3', '趴睡_4', '其他_5',]
        })
      }
    }

    // this.props.changeDateArr(e.info)
    // if (ws && ws.readyState === 1)
    //   ws.send(JSON.stringify({ sitPort: e }));
  }


  onNameChange = (event) => {
    this.setState({ name: event.target.value });
    console.log(event.target.value)
    // this.setState({ colName:  event.target.value + timeStampToDateNospace(Date.parse(new Date())) })
  };
  addItem = (e) => {
    e.preventDefault();
    const items = this.state.items
    this.setState({ items: [...items, this.state.name], name: '' });
    // this.setState({});
    localStorage.setItem('sitType', JSON.stringify([...items, this.state.name]))
    setTimeout(() => {
      this.inputRef.current?.focus();
    }, 0);
  };

  onChange1 = (value) => {
    this.setState({ realname1: value })
    this.setState({ colName: this.state.realname + value })
  };

  onNameChange1 = (event) => {
    this.setState({ name1: event.target.value });
  };
  addItem1 = (e) => {
    e.preventDefault();
    const items = this.state.items1
    this.setState({ items1: [...items, this.state.name1], name1: '' });
    // this.setState({});
    localStorage.setItem('sitType1', JSON.stringify([...items, this.state.name1]))
    setTimeout(() => {
      this.inputRef.current?.focus();
    }, 0);
  };

  render() {
    const routerStr = this.props.matrixName == 'yanfeng10' ? '10a10' : this.props.matrixName == 'matCol' || this.props.matrixName == 'matColPos' ? '16a10' : this.props.matrixName == 'bed4096' ? '64a64' : this.props.matrixName == 'carCol' ? '10a9' : '32a32'
    const { t, i18n } = this.props;


    // 全量传感器类型列表
    const allSensorArr = [
      { label: '触觉手套', value: 'hand0205' },
      { label: '宇树G1触觉上衣', value: 'robot1' },
      { label: '松延N2触觉上衣', value: 'robotSY' },
      { label: '零次方H1触觉上衣', value: 'robotLCF' },
      { label: '触觉足底', value: 'footVideo' },
      { label: '沙发', value: 'sofa' },
      { label: '14*20高速', value: 'daliegu' },
      { label: '眼罩', value: 'eye' },
      { label: '4096数字', value: 'bed4096num' },
      { label: '轮椅', value: 'yanfeng10' },
      { label: '脚型检测', value: 'foot' },
      { label: '清闲椅子', value: 'carQX' },
      { label: '沃尔沃', value: 'volvo' },
      { label: '汽车', value: 'car' },
      { label: '汽车靠背(量产)', value: 'car10' },
      { label: '小床监测', value: 'jqbed' },
      { label: '小床褥采集', value: 'matCol' },
      { label: '小床睡姿采集', value: 'matColPos' },
      { label: '车载传感器', value: 'carCol' },
      { label: '手套监测', value: 'newHand' },
      { label: '席悦1.0', value: 'smallBed' },
      { label: '席悦2.0', value: 'xiyueReal1' },
      { label: '手套96', value: 'gloves' },
      { label: '左手手套', value: 'gloves1' },
      { label: '右手手套', value: 'gloves2' },
      { label: '手套触觉', value: 'hand0205Point' },
      { label: '手套触觉147', value: 'hand0205Point147' },
      { label: '清闲', value: 'ware' },
      { label: '机器人出手', value: 'robot' },
      { label: '手部视频', value: 'handVideo' },
      { label: '手部视频1', value: 'handVideo1' },
      { label: '256', value: 'bed1616' },
      { label: '256鞋垫', value: 'footVideo256' },
      { label: '4096', value: 'bed4096' },
      { label: '16*16高速', value: 'fast256' },
      { label: '32*32高速', value: 'fast1024' },
      { label: '1024高速座椅', value: 'fast1024sit' },
      { label: 'car100', value: 'car100' },
      { label: '3D数字', value: 'Num3D' },
      { label: '机器人', value: 'robot0428' },
      { label: '手套模型', value: 'hand0507' },
      { label: '床垫监测', value: 'bigBed' },
      { label: '席悦座椅', value: 'sit10' },
      { label: '小矩陣1', value: 'smallM' },
      { label: '矩陣2', value: 'rect' },
      { label: 'T-short', value: 'short' },
      { label: '唐群座椅', value: 'CarTq' },
      { label: '正常测试', value: 'normal' },
      { label: '清闲', value: 'chairQX' },
      { label: '本地自适应', value: 'localCar' },
      { label: '手部检测(蓝)', value: 'handBlue' },
      { label: '座椅采集', value: 'sitCol' },
      { label: '小床128', value: 'smallBed1' },
    ]

    // 根据 allowedTypes 过滤传感器列表
    const sensorArr = this.props.allowedTypes
      ? allSensorArr.filter(item => this.props.allowedTypes.includes(item.value))
      : allSensorArr;

    const navItems = [
      {
        label: t('realTime'),
        key: 'now',
      },
      {
        label: t('playBack'),
        key: 'playback',
      },
    ];

    const carItems = [
      {
        label: t('all'),
        key: 'all',
      },
      {
        label: t('back'),
        key: 'back',
      },
      {
        label: t('sit'),
        key: 'sit',
      }, {
        label: t('head'),
        key: 'head',
      },
    ];
    // console.log('title')
    return <div className="title">
      {/* <h2>bodyta</h2> */}
      <div style={{ display: 'flex', alignItems: 'center', color: '#5A5A89' }}> <img src={logo} style={{ height: '60px' }} alt="" />JQTOOLS-robot</div>
      <div className="titleItems">
        {this.props.matrixTitle ? <Select
          style={{ width: '140px' }}
          placeholder={t('chooseSensor')}
          onChange={(e) => {
            this.changeMatrixType(e)
            this.props.changeStateData({
              numMatrixFlag: 'normal'
            })

            this.props.wsSendObj({ resetZero: false })

            this.props.changeStateData({
              portname: '',
              portnameBack: '',
              portnameHead: ''
            })
          }}
          options={sensorArr}
        /> : ''}


        {
          this.props.matrixName.includes('fast') || this.props.matrixName == 'bed4096' || this.props.matrixName == 'bed4096num' || this.props.matrixName == 'bed1616' || this.props.matrixName == 'fast256' || this.props.matrixName == 'footVideo256' ? <Input onChange={(e) => {
            const value = e.target.value
            this.props.wsSendObj({
              baudRate: value
            })
          }} /> : ''
        }

        {console.log(this.props.matrixName, 'this.props.matrixName')}
        <Menu className='menu' onClick={this.onClick} selectedKeys={[this.state.current]} mode="horizontal" items={navItems} />
        {this.props.matrixName != 'localCar' ? this.props.history === 'now' ? this.props.matrixName != 'car' && this.props.matrixName != 'car10' && this.props.matrixName != 'sofa' && this.props.matrixName != 'yanfeng10' && this.props.matrixName != 'volvo' && this.props.matrixName != 'carQX' && this.props.matrixName != 'hand0507' && this.props.matrixName != 'hand0205' && this.props.matrixName != 'footVideo' && this.props.matrixName != 'eye' ? <><Select

          style={{ marginRight: 20, width: 160 }}
          placeholder={t('chooseSensor')}
          value={this.props.portname ? this.props.portname : null}
          onDropdownVisibleChange={() => {
            this.props.wsSendObj({ serialReset: true })
          }}

          onSelect={(e) => {
            this.props.wsSendObj({ sitPort: e })
            this.props.changeStateData({ portname: e })

          }}
          options={this.props.port}
        >
        </Select> <div></div></> : <><Select

          style={{ marginRight: 20, width: 160 }}
          placeholder={['hand0205'].includes(this.props.matrixName) ? t('chooseLeftSensor') : this.props.matrixName == 'footVideo' ? t('chooseLeftFootSensor') : t('chooseSitSensor')}
          value={this.props.portname ? `${this.props.portname}${['hand0205', 'footVideo', 'eye'].includes(this.props.matrixName) ? t('left') : (t('sit'))}` : null}
          onDropdownVisibleChange={() => {
            this.props.wsSendObj({ serialReset: true })
          }}
          onSelect={(e) => {

            console.log(e);
            this.props.wsSendObj({ sitPort: e })
            this.props.changeStateData({ portname: e })
            this.props.changeStateData({
              hand: true
            })
            if (this.props.com.current?.changeModal) this.props.com.current?.changeModal(true)

          }}
          options={this.props.port}
        >
        </Select>


          <Select
            // value={this.props.portnameBack}
            placeholder={['hand0205'].includes(this.props.matrixName) ? t('chooseRightSensor') : this.props.matrixName == 'footVideo' ? t('chooseRightFootSensor') : t('chooseBackSensor')}
            style={{ marginRight: 20, width: 160 }}
            value={this.props.portnameBack ? `${this.props.portnameBack}${['hand0205', 'footVideo'].includes(this.props.matrixName) ? t('right') : (t('back'))}` : null}
            onDropdownVisibleChange={(e) => {
              console.log(e)
              this.props.wsSendObj({ serialReset: true })
            }}
            onSelect={(e) => {
              // this.props.handleChangeCom(e);
              console.log(e);
              this.props.wsSendObj({ backPort: e })

              this.props.changeStateData({ portnameBack: e })

              this.props.changeStateData({
                hand: false
              })
              if (this.props.com.current?.changeModal) this.props.com.current?.changeModal(false)

            }}

            options={this.props.port}
          >
          </Select>

          {this.props.matrixName == 'volvo' || this.props.matrixName == 'carQX' ? <Select
            // value={this.props.portnameBack}
            placeholder={t('chooseHeadSensor')}
            style={{ width: 160 }}
            value={this.props.portnameHead ? `${this.props.portnameHead}(${t('head')})` : null}
            onDropdownVisibleChange={(e) => {
              console.log(e)
              this.props.wsSendObj({ serialReset: true })
            }}
            onSelect={(e) => {
              // this.props.handleChangeCom(e);
              console.log(e);
              this.props.wsSendObj({ headPort: e })
              this.props.changeStateData({ portnameHead: e })

            }}

            options={this.props.port}
          >
          </Select> : null}

        </> : <Select
          // value={this.props.dataArr}
          placeholder={t('choosePlaybackTime')}
          style={{ marginRight: 20 }}
          onChange={(e) => {
            // this.props.handleChangeCom(e);
            if (this.props.matrixName === 'foot') {
              this.props.track.current?.canvasInit()
            }

            console.log(e);
            this.props.changeStateData({ dataTime: e })
            this.setState({ dataTime: e })
            this.props.wsSendObj({ getTime: e, index: 0 })
            if (this.props.history === 'history') {
              this.props.wsSendObj({ getTime: e, index: 0, history: true })
            } else {
              this.props.wsSendObj({ getTime: e, index: 0 })
            }
            // this.props.wsSendObj({port : e})
            // if (ws && ws.readyState === 1)
            //   ws.send(JSON.stringify({ sitPort: e }));
          }}
          value={this.state.dataTime ? this.state.dataTime : null}
          options={this.props.dataArr}
        >

        </Select> :
          <>
            <Input value={this.state.ip} onChange={(e) => {
              localStorage.setItem('ip', e.target.value)
              this.setState({ ip: e.target.value })
            }} placeholder='请输入IP' />
            <Button onClick={() => { this.props.changeWs(this.state.ip) }}>连接</Button>
          </>

        }




        {this.props.matrixName != 'car10' && ['hand0205', 'footVideo', 'robot1', 'robotSY', 'robotLCF'].includes(this.props.matrixName) ?
          <Select
            defaultValue={this.props.numMatrixFlag}
            style={{ width: 90 }}
            value={this.props.numMatrixFlag}
            onChange={(value) => {
              // localStorage.setItem('language', value)
              this.props.changeStateData({ numMatrixFlag: value })
              //  this.props.i18n.changeLanguage(value)

              if (this.props.matrixName == 'hand0205') {
                if (['normal', 'skin'].includes(this.props.numMatrixFlag)) {
                  this.props.com.current?.changeModal(this.props.hand)
                }

                if (value == 'normal') {
                  this.props.wsSendObj({ resetZero: false })
                } else {
                  this.props.wsSendObj({ resetZero: true })
                }
              }



            }}
            options={this.props.matrixName == 'hand0205' ? [
              { value: 'num', label: t('data2D') },
              { value: 'normal', label: t('tel3D') },
              { value: 'num3D', label: t('data3D') },
              { value: 'numoriginal', label: t('rawData') },
              { value: 'skin', label: t('skin3D') },
            ] : this.props.matrixName == 'footVideo' ? [
              { value: 'num', label: t('data2D') },
              { value: 'normal', label: t('modal3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : this.props.matrixName.includes('robot') ? [
              { value: 'normal', label: t('modal3D') },
              { value: 'numoriginal', label: t('rawData') },
            ] : ''}
          /> : ''
        }

        {
          this.props.matrixName == 'hand0205' ?
            <Modal
              mask={false}
              width={450}
              className='calibModal'
              title={t('deviceCal')}
              closable={{ 'aria-label': 'Custom Close Button' }}
              open={this.props.calibration}
              onOk={() => {
                this.props.changeStateData({
                  calibration: false
                })
              }}
              onCancel={() => {
                this.props.changeStateData({
                  calibration: false
                })
              }}
            >
              <Select
                defaultValue={this.state.fingerIndex}
                style={{ width: 120 }}
                onChange={(e) => {
                  this.setState({
                    fingerIndex: e
                  })
                  if (e == 1) {
                    this.props.com.current?.calibration(new Array(5).fill(1))
                  } else {
                    this.props.com.current?.calibration(new Array(5).fill(0))
                  }
                }}
                options={[
                  { value: 0, label: t('FingersSpread') },
                  { value: 1, label: t('fist') },
                ]}
              />

              <Button
                onClick={() => {
                  // const arr = localStorage.getItem('fingerArr') ? JSON.parse(localStorage.getItem('fingerArr')) : []
                  // arr[this.state.fingerIndex] = []
                  this.props.colFingerData(this.state.fingerIndex)
                }}
              >{t('colData')}</Button>
              <Button
                onClick={() => {
                  localStorage.removeItem('fingerArr')
                }}
              >{t('clearData')}</Button>

            </Modal>
            : ""
        }



        {/* {this.props.matrixName == 'hand0205' ?
          <div className="asideContent firstAside" style={{
            position: 'absolute', right: '20%', top: '80px',
            opacity: this.props.calibration ? 1 : 0, transition: 'opacity 0.5s ease', border: '1px solid #2a5bc5',
            flexDirection: 'column'
          }}>

            <h2 className="asideTitle">设备校准</h2>
            <Select
              defaultValue={this.state.fingerIndex}
              style={{ width: 120 }}
              onChange={(e) => {
                this.setState({
                  fingerIndex: e
                })
                if (e == 1) {
                  this.props.com.current?.calibration(new Array(5).fill(1))
                } else {
                  this.props.com.current?.calibration(new Array(5).fill(0))
                }
              }}
              options={[
                { value: 0, label: '手指平铺' },
                { value: 1, label: '手指握拳' },
              ]}
            />

            <Button
              onClick={() => {
                // const arr = localStorage.getItem('fingerArr') ? JSON.parse(localStorage.getItem('fingerArr')) : []
                // arr[this.state.fingerIndex] = []
                this.props.colFingerData(this.state.fingerIndex)
              }}
            >采集数据</Button>
            <Button
              onClick={() => {
                localStorage.removeItem('fingerArr')
              }}
            >清除历史数据</Button>

            <div>
              <Button>完成</Button>
            </div>


          </div>
          : ''} */}

        {/* {this.props.matrixName == 'hand0205' ?
          <Select
            defaultValue={this.props.hand}
            style={{ width: 80 }}
            onChange={(e) => {
              console.log(e)
              this.props.changeStateData({
                hand: e
              })
              this.props.com.current?.changeModal(e)
            }}
            options={[
              { value: true, label: t('leftHand') },
              { value: false, label: t('rightHand') },
            ]}
          />

          : ''} */}


        {this.props.matrixName == 'hand0205' && this.props.numMatrixFlag == 'normal' ? <Button className='titleButton'
          onClick={() => {
            // this.props.com.current?.calibration()
            // this.setState({
            //   calibration: !this.state.calibration
            // })



            // 校准弹框
            this.props.changeCalibration()

            // 手固定
            this.props.com.current?.handZero()
          }}
        >{t('calib')}</Button> : this.props.matrixName == 'hand0205' && this.props.numMatrixFlag == 'skin' ? <Button className='titleButton'
          onClick={() => {
            // this.props.com.current?.calibration()
            // this.setState({
            //   calibration: !this.state.calibration
            // })
            // this.props.changeCalibration()
            this.props.com.current?.handZero()
          }}
        >固定</Button> : ''}

        <Button onClick={() => {
          this.props.wsSendObj({
            sitClose: true,
            backClose: true,
            headClose: true
          })
        }} className='titleButton'>
          {t('closeSensor')}
        </Button>




        <Select
          defaultValue={this.props.i18n.language}
          style={{ width: 60 }}
          onChange={(value) => {
            localStorage.setItem('language', value)
            this.props.i18n.changeLanguage(value)
          }}
          options={[
            { value: 'zh', label: '中' },
            { value: 'en', label: 'En' },
          ]}
        />


        {this.props.matrixName == 'car' || this.props.matrixName == 'car10' || this.props.matrixName == 'localCar' || this.props.matrixName == 'yanfeng10' || this.props.matrixName == 'volvo' ?


          <Menu className='menu' onClick={this.onCarClick} selectedKeys={[this.state.carCurrent]} mode="horizontal" items={carItems} />
          : null}
        {!this.props.local ?
          <>
            {/* {this.props.matrixName == 'car' ? <Input placeholder='输入采集文件名称' onChange={(e) => { this.setState({ colName: e.target.value }) }} /> : null} */}

            {this.props.matrixName == 'localCar' ?
              <Input placeholder='输入采集标签' onChange={(e) => { this.props.changeStateData({ dataName: e.target.value }) }} />
              : null}
            {/* <Input type='number' placeholder={t('enterColHZ')} onChange={(e) => { this.setState({ colHZ: e.target.value }) }} /> */}
            <Button
              className='titleButton'
              onClick={() => {

                if (this.props.matrixName !== 'localCar') {
                  const flag = this.props.colFlag
                  const formattedDate = Date.now()
                  if (flag) {
                    console.log(this.state.colName)
                    if (this.state.colName) {
                      this.props.wsSendObj({ colHZ: this.state.colHZ, flag: true, colName: this.state.colName + '_' + timeStampToDateNospace(formattedDate) + ' ' + formattedDate })
                      loadData = this.state.colName + '_' + timeStampToDateNospace(formattedDate) + ' ' + formattedDate
                    } else {
                      this.props.wsSendObj({ colHZ: this.state.colHZ, flag: true, time: formattedDate })
                    }
                    // this.setState({loadName : this.state.colName + timeStampToDateNospace(formattedDate)+ ' ' + formattedDate})

                  } else {
                    this.props.wsSendObj({ colHZ: this.state.colHZ, flag: flag })
                    if (this.props.matrixName == 'sitCol' || this.props.matrixName == 'matCol') {
                      this.props.wsSendObj({ colHZ: this.state.colHZ, download: loadData })
                    }
                  }
                  // console.log(flag)
                  // this.props.setColFlag(!flag)
                  this.props.changeStateData({ colFlag: !flag })
                  this.props.setColValueFlag(flag)
                } else {

                  const flag = this.props.colWebFlag
                  console.log(flag)
                  this.props.changeStateData({ colWebFlag: !flag })
                }
              }}>{this.props.colFlag ? t('col') : t('stop')}{this.props.matrixName == 'localCar' ? this.props.length - 1 : Math.ceil(this.state.num)}
            </Button>
            {this.props.matrixName == 'localCar' ?

              <>
                <Button onClick={() => {
                  this.props.colPushData()
                }} className='titleButton'>
                  单次采集
                </Button>
                <Button className='titleButton'>
                  <CSVLink
                    // ref={downloadRef}

                    filename={`${new Date().getTime()}.csv`}
                    data={this.props.csvData}
                    style={{ color: '#5A5A89', textDecoration: 'none' }}
                  >
                    下载
                  </CSVLink> </Button> </> : null}

            {this.props.matrixName == 'localCar' ?
              <Button className='titleButton' onClick={() => {

                this.props.delPushData()
              }}>删除</Button> : null}
          </>
          : <> <Button
            className='titleButton'
            onClick={() => {
              this.props.wsSendObj({ download: this.state.dataTime })
            }}
          >{t('download')}</Button>
            <Button
              className='titleButton'
              onClick={() => {
                this.props.wsSendObj({ delete: this.state.dataTime })
              }}
            >{t('delete')}</Button>

          </>
        }

        {
          this.props.matrixName === 'car' && this.props.local ? <Button className='titleButton' onClick={() => {
            this.props.wsSendObj({ variety: true })
          }} >压力变化</Button> : null
        }

        {this.props.matrixName === 'bigBed' ? <Button className='titleButton' onClick={() => {
          const flag = this.props.pressChart
          this.props.changeStateData({ pressChart: !flag })
          this.props.initBigCtx()
        }}>压力曲线</Button> : null}

        {this.props.matrixName === 'bigBed' ? <Button className='titleButton' onClick={() => {

          if (this.props.com.current) {
            this.props.com.current.logData()
          }
          // this.props.initPressCtx()
        }}>打印曲线</Button> : null}



        {this.props.matrixName == 'foot' ? <Button
          className='titleButton'
          onClick={() => {
            const flag = this.props.centerFlag
            this.props.changeStateData({ centerFlag: !flag })
            console.log(this.props.com.current)
            this.props.com.current?.changeCenterFlag(flag)
            if (flag) {
              this.props.track.current?.canvasInit()
            }
          }}>{!this.props.centerFlag ? '重心' : '隐藏'}</Button> : null}
      </div>


      {
        this.props.matrixName == 'Num3D' ? <Select
          // value={this.props.portnameBack}
          placeholder={t('chooseBackSensor')}
          style={{ marginRight: 20, width: 60 }}

          onDropdownVisibleChange={(e) => {

          }}
          onSelect={(e) => {

            // if (e == 1) {
            //   this.props.com.current?.calibration(new Array(5).fill(1))
            // } else {
            //   this.props.com.current?.calibration(new Array(5).fill(0))
            // }
            this.props.changeStateData({ showType: e })


          }}

          options={[
            { value: 'finger', label: '中指' },
            { value: 'palm', label: '手掌' },
            { value: 'hand', label: '全手' },
          ]}
        ></Select> : ''
      }

      <div style={{ position: 'relative' }}>
        <img onClick={() => {
          const show = this.state.show
          this.setState({
            open: true
          })
        }} className='optionImg' src={option} alt="" />
        <Drawer style={{ backgroundColor: 'rgba(21,18,42,0.8)' }} title={t('setData')} onClose={() => { this.setState({ open: false }) }} open={this.state.open}>
          <div className='slideContent' style={{ width: '300px', }}>
            <div
              className="flexcenter"
              style={{
                flex: 1,
                flexDirection: "column",
              }}
            >
              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('guass')}
                </div>
                <Slider
                  min={0.1}
                  max={8}
                  onChange={(value) => {
                    localStorage.setItem("carValueg", value);

                    this.props.changeStateData({ valueg1: value })

                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valueg1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valueg: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valueg: value,
                        });
                      }
                      // if(this.props.com.current.changeColor){
                      //   this.props.com.current.changeColor({size : value})
                      // }
                    }

                  }}
                  value={this.props.valueg1}
                  step={0.1}

                  style={{ width: '200px' }}
                />
              </div>


              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('size')}
                </div>
                <Slider
                  min={1}
                  max={50}
                  onChange={(value) => {
                    // localStorage.setItem("carValueg", value);

                    // this.props.changeStateData({ valueg1: value })

                    // changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valueg1', value })

                    if (this.props.com.current) {
                      // if (this.props.com.current.sitValue) {
                      //   this.props.com.current.sitValue({
                      //     valueg: value,
                      //   });
                      // }
                      // if (this.props.com.current.backValue) {
                      //   this.props.com.current.backValue({
                      //     valueg: value,
                      //   });
                      // }
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({ size: value })
                      }
                    }

                  }}
                  // value={this.props.valueg1}
                  step={0.1}

                  style={{ width: '200px' }}
                />
              </div>


              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('speed')}
                </div>
                <Slider
                  min={1}
                  max={20}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({
                          speedValue: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={1}
                  style={{ width: '200px' }}
                />
              </div>


              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('分压')}
                </div>
                <Slider
                  min={0}
                  max={this.props.matrixName == 'fast256' ? 20 : 3000}
                  onChange={(value) => {


                    // this.props.changeStateData({ press: value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          press: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          press: value,
                        });
                      }
                      // if(this.props.com.current.changeColor){
                      //   this.props.com.current.changeColor({size : value})
                      // }
                    }

                  }}
                  // value={this.props.press}
                  step={this.props.matrixName == 'fast256' ? 0.1 : 1}

                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('乘值')}
                </div>
                <Slider
                  min={0}
                  max={10}
                  onChange={(value) => {


                    this.props.changeStateData({ prop: value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          prop: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          prop: value,
                        });
                      }
                      // if(this.props.com.current.changeColor){
                      //   this.props.com.current.changeColor({size : value})
                      // }
                    }

                  }}
                  // value={this.props.press}
                  step={0.02}

                  style={{ width: '200px' }}
                />
              </div>


              <div
                className="progerssSlide"
                style={{
                  display: "flex",
                  alignItems: "center",
                  //   padding : '5px',
                  //   borderRadius : 10,
                  //   backgroundColor : '#72aec9'
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('color')}
                </div>
                <Slider
                  min={5}
                  max={1000}
                  onChange={(value) => {
                    localStorage.setItem("carValuej", value);
                    // this.props.setValuej1(value);
                    this.props.changeStateData({ valuej1: value })

                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuej1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valuej: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuej: value,
                        });
                      }
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({ max: value })
                      }

                    }


                  }}
                  value={this.props.valuej1}
                  step={10}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>
              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('filter')}
                </div>
                <Slider
                  min={0}
                  max={100}
                  onChange={(value) => {
                    localStorage.setItem("carValuef", value);
                    // this.props.setValuef1(value);
                    this.props.changeStateData({ valuef1: value })
                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuef1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valuef: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuef: value,
                        });
                      }

                      if (this.props.com.current.backValue) {
                        this.props.com.current.changeColor({
                          filter: value,
                        });
                      }
                    }


                  }}
                  value={this.props.valuef1}
                  step={2}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div

                  className='dataTitle'
                >
                  {t('height')}
                </div>
                <Slider
                  min={0.1}
                  max={15}
                  onChange={(value) => {
                    localStorage.setItem("carValue", value);
                    // this.props.setValue1(value);
                    this.props.changeStateData({ value1: value })
                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'value1', value })


                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          value: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          value: value,
                        });
                      }
                    }


                  }}
                  value={this.props.value1}
                  step={0.02}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>
              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div

                  className='dataTitle'
                >
                  {t('consis')}
                </div>
                <Slider
                  min={1}
                  max={20}
                  onChange={(value) => {
                    localStorage.setItem("carValuel", value);
                    // this.props.setValuel1(value);
                    this.props.changeStateData({ valuel1: value })
                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuel1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valuel: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuel: value,
                        });
                      }
                    }



                  }}
                  value={this.props.valuel1}
                  step={1}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('init')}
                </div>
                <Slider
                  min={1}
                  max={5000}
                  onChange={(value) => {
                    localStorage.setItem("carValueInit", value);
                    // this.props.setValuelInit1(value);
                    this.props.changeStateData({ valuelInit1: value })

                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuelInit1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValsue) {
                        this.props.com.current.sitValue({
                          valuelInit: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuelInit: value,
                        });
                      }
                    }
                  }}
                  value={this.props.valuelInit1}
                  step={500}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('light')}
                </div>
                <Slider
                  min={0}
                  max={1}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({
                          light: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={0.001}
                  style={{ width: '200px' }}
                />
              </div>



              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('x')}
                </div>
                <Slider
                  min={- maxValue}
                  max={maxValue}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changaCamera) {
                        this.props.com.current.changaCamera({
                          x: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={1}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('y')}
                </div>
                <Slider
                  min={- maxValue}
                  max={maxValue}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changaCamera) {
                        this.props.com.current.changaCamera({
                          y: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={1}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('z')}
                </div>
                <Slider
                  min={-maxValue}
                  max={maxValue}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changaCamera) {
                        this.props.com.current.changaCamera({
                          z: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={1}
                  style={{ width: '200px' }}
                />
              </div>

              {/* 分压 */}
              {/* <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('init')}
                </div>
                <Slider
                  min={1}
                  max={6000}
                  onChange={(value) => {
                    this.props.wsSendObj({ up: value })
                  }}
                  // value={this.props.valuelInit1}
                  step={1}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('init')}
                </div>
                <Slider
                  min={0.1}
                  max={20}
                  onChange={(value) => {
                    this.props.wsSendObj({ down: value })
                  }}
                  // value={this.props.valuelInit1}
                  step={0.1}
                  style={{ width: '200px' }}
                />
              </div> */}

            </div>
          </div>
          <>
            <Select
              style={{ width: 300 }}
              placeholder={t('feaLabel')}
              onChange={this.onChange}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="Please enter item"
                      ref={this.inputRef}
                      value={this.state.name}
                      onChange={this.onNameChange}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <Button type="text" icon={<PlusOutlined />} onClick={this.addItem}>
                      {t('add')}
                    </Button>
                    <Button type="text" onClick={() => {
                      this.setState({ items: [] })
                      localStorage.removeItem('sitType')
                    }}>
                      {t('delete')}
                    </Button>
                  </Space>
                </>
              )}
              options={this.state.items.map((item) => ({ label: item, value: item }))}
            />
            <Select
              style={{ width: 300 }}
              placeholder={t('feaLabel')}
              onChange={this.onChange1}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="Please enter item"
                      ref={this.inputRef1}
                      value={this.state.name1}
                      onChange={this.onNameChange1}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <Button type="text" icon={<PlusOutlined />} onClick={this.addItem1}>
                      {t('add')}
                    </Button>
                    <Button type="text" onClick={() => {
                      this.setState({ items1: [] })
                      localStorage.removeItem('sitType1')
                    }}>
                      {t('delete')}
                    </Button>
                  </Space>
                </>
              )}
              options={this.state.items1.map((item) => ({ label: item, value: item }))}
            />


            <> <Button onClick={() => {

              this.props.changeAside({
                resetZero: true
              })
              this.props.wsSendObj({ resetZero: true })

            }}>{t('resetZero')}</Button>
              <Button onClick={() => {

                this.props.changeAside({
                  resetZero: false
                })

                this.props.wsSendObj({ resetZero: false })
              }}>{t('cancelZero')}</Button></>


            <NavLink to={`/num/${routerStr}`}> <Button onClick={() => {
              this.props.dataZero0()
            }}>{t('rawData')}</Button></NavLink>

            <NavLink to={`/?a=b`}> <Button onClick={() => {

            }}>{t('key')}</Button></NavLink>
          </>
        </Drawer>
      </div>





    </div>
      ;
  };
}
export default withTranslation('translation', { withRef: true })(Title);