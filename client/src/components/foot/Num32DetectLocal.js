import { color } from 'echarts';
import React, { useEffect, useRef, useState, useImperativeHandle } from 'react';

let firstData, lastData;
const Data = React.forwardRef((porps, refs) => {
  const [data, setData] = useState(new Array(32).fill(new Array(32).fill(0)));
  const [scale, setScale] = useState(1);
  const container = useRef();

  const changeWsData = (wsPointData) => {
    console.log(wsPointData);
    let newData = [];

    // gaussBlur_2(wsPointData , newData , 32, 32, 1.0)

    // wsPointData = newData
    // wsPointData = newData
    // wsPointData = newData
    let a = [];
    for (let i = 0; i < 32; i++) {
      a[i] = [];
      for (let j = 0; j < 32; j++) {
        a[i].push(wsPointData[i * 32 + j]);
      }
    }

    // wsPointData = a;
    setData(a);
  };

  const drawContent = () => {};

  useImperativeHandle(refs, () => ({
    changeWsData: changeWsData,
    drawContent: drawContent,
  }));

  function jet(min, max, x) {
    let r, g, b;
    let dv;
    r = 1;
    g = 1;
    b = 1;
    if (x < min) x = min;
    if (x > max) x = max;
    dv = max - min;
    if (x < min + 0.25 * dv) {
      r = 0;
      g = (4 * (x - min)) / dv;
    } else if (x < min + 0.5 * dv) {
      r = 0;
      b = 1 + (4 * (min + 0.25 * dv - x)) / dv;
    } else if (x < min + 0.75 * dv) {
      r = (4 * (x - min - 0.5 * dv)) / dv;
      b = 0;
    } else {
      g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
      b = 0;
    }
    var rgb = new Array();
    rgb[0] = parseInt(255 * r);
    rgb[1] = parseInt(255 * g);
    rgb[2] = parseInt(255 * b);
    return rgb;
  }

  function boxesForGauss(sigma, n) {
    // standard deviation, number of boxes
    var wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1); // Ideal averaging filter width
    var wl = Math.floor(wIdeal);
    if (wl % 2 == 0) wl--;
    var wu = wl + 2;
    var mIdeal =
      (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    var m = Math.round(mIdeal);
    var sizes = [];
    for (var i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
    return sizes;
  }

  function gaussBlur_2(scl, tcl, w, h, r) {
    var bxs = boxesForGauss(r, 3);
    boxBlur_2(scl, tcl, w, h, (bxs[0] - 1) / 2);
    boxBlur_2(tcl, scl, w, h, (bxs[1] - 1) / 2);
    boxBlur_2(scl, tcl, w, h, (bxs[2] - 1) / 2);
  }

  function boxBlur_2(scl, tcl, w, h, r) {
    for (var i = 0; i < h; i++)
      for (var j = 0; j < w; j++) {
        var val = 0;
        for (var iy = i - r; iy < i + r + 1; iy++)
          for (var ix = j - r; ix < j + r + 1; ix++) {
            var x = Math.min(w - 1, Math.max(0, ix));
            var y = Math.min(h - 1, Math.max(0, iy));
            val += scl[y * w + x];
          }
        tcl[i * w + j] = val / ((r + r + 1) * (r + r + 1));
      }
  }

  useEffect(() => {
    var WW = document.documentElement.clientWidth;
    var scaleNum = WW / 1920;
    setScale(scaleNum);
    const ws = new WebSocket('ws://127.0.0.1:19999');
    // const ws = new WebSocket('ws://127.0.0.1:59786/c1');
    ws.onopen = () => {
      // connection opened
      console.info('connect success');
    };
    ws.onmessage = (e) => {
      let jsonObject = JSON.parse(e.data);
      //处理空数组
      // console.log(jsonObject);
      if (jsonObject.sitData != null) {
        let wsPointData = jsonObject.sitData;
        let newData = [];
        let ndata = wsPointData;
        let a = [];

        // let afirst = wsPointData.slice(0,15*32)
        // let alast = wsPointData.slice(15*32,32*32)
        // wsPointData = alast.concat(afirst)

        // for (let i = 0; i < 8; i++) {
        //   for (let j = 0; j < 32; j++) {
        //     [wsPointData[(17+i) * 32 + j], wsPointData[(14 + 17-i) * 32 + j]] = [
        //       wsPointData[(14 + 17-i) * 32 + j],
        //       wsPointData[(17+i) * 32 + j],
        //     ];
        //   }
        // }

        // for (let i = 0; i < 32; i++) {
        //   for (let j = 0; j < 8; j++) {
        //     [wsPointData[i * 32 + 15-j], wsPointData[(i) * 32 + j]] = [
        //       wsPointData[(i) * 32 + j],
        //       wsPointData[i * 32 + 15-j],
        //     ];
        //   }
        // }

        // for(let i = 0 ; i < 32 ; i++){
        //   wsPointData[10*32 + i] =  wsPointData[9*32 + i]
        // }

        

        for (let i = 0; i < 32; i++) {
          a[i] = [];
          for (let j = 0; j < 32; j++) {
            a[i].push(wsPointData[i * 32 + j]);
          }
        }

       

        // wsPointData = a;
        setData(a);
      }
    };
    ws.onerror = (e) => {
      // an error occurred
    };
    ws.onclose = (e) => {
      // connection closed
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div className="threeBoxF" style={{ color: '#000' }}>
        <div className="threeBox">
          {data.map((items, indexs) => {
            return (
              <div key={indexs} style={{ display: 'flex' }}>
                {items && items.length
                  ? items.map((item, index) => {
                      return (
                        <div
                          key={index}
                          style={{
                            width: '30px',
                            lineHeight: '30px',
                            fontSize : '20px'
                          }}
                        >
                          {parseInt(item)}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default Data;
