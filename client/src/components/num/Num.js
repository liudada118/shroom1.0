import React, { useEffect, useState, useImperativeHandle } from 'react'
import './num.css'
var valuej1 = localStorage.getItem('carValuej') ? JSON.parse(localStorage.getItem('carValuej')) : 200,
    valueg1 = localStorage.getItem('carValueg') ? JSON.parse(localStorage.getItem('carValueg')) : 2,
    value1 = localStorage.getItem('carValue') ? JSON.parse(localStorage.getItem('carValue')) : 2,
    valuel1 = localStorage.getItem('carValuel') ? JSON.parse(localStorage.getItem('carValuel')) : 2,
    valuef1 = localStorage.getItem('carValuef') ? JSON.parse(localStorage.getItem('carValuef')) : 2,
    valuelInit1 = localStorage.getItem('carValueInit') ? JSON.parse(localStorage.getItem('carValueInit')) : 2

export const Num = React.forwardRef((props, refs) => {
    let width = 32 , height = 32
    if(props.matrixName == 'carCol'){
        width = 10
        height = 9
    }
    const [data, setData] = useState(new Array(height).fill(new Array(width).fill(0)));
    const [scale, setScale] = useState(1)
    
    

    const changeWsData = (wsPointData) => {

        console.log(wsPointData.length,valuef1)
        let newData = [...wsPointData]
        let dataG = []
        let ndata = [...newData].map((a, index) => (a - valuef1 < 0 ? 0 : a));
        const ndataNum = ndata.reduce((a, b) => a + b, 0);
        if (ndataNum < valuelInit1) {
            ndata = new Array(width * height).fill(1);
        } 

        gaussBlur_2(ndata, dataG, width, height, 1)


        wsPointData = dataG

        let a = [];
        for (let i = 0; i < height; i++) {
            a[i] = [];
            for (let j = 0; j < width; j++) {
                a[i].push(wsPointData[i * width + j]);
            }
        }

        // wsPointData = a;
        setData(a);
    }

    const sitValue = (prop) => {
        console.log(prop)
        const { valuej, valueg, value, valuel, valuef, valuelInit } = prop;
        if (valuej) valuej1 = valuej;
        if (valueg) valueg1 = valueg;
        if (value) value1 = value;
        if (valuel) valuel1 = valuel;
        if (valuef) valuef1 = valuef;
        if (valuelInit) valuelInit1 = valuelInit;

    }

    const drawContent = () => { }

    useImperativeHandle(refs, () => ({

        changeWsData: changeWsData,
        drawContent: drawContent,
        sitValue
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

    function boxesForGauss(sigma, n)  // standard deviation, number of boxes
    {
        var wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);  // Ideal averaging filter width
        var wl = Math.floor(wIdeal);
        if (wl % 2 == 0) wl--;
        var wu = wl + 2;
        var mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
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
        var WW = document.documentElement.clientWidth
        var scaleNum = WW / 1920
        setScale(scaleNum)
    }, []);

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems : 'center',
                backgroundColor: '#000',
                // alignItems: 'center'
            }}
        >
            <div
                className="threeBoxF"
                style={{
                    color: 'blue', transformStyle: 'preserve-3d',
                    perspective: '500px',
                  
                }}
            >
                <div className="threeBox"
                 style={{   transform: 'rotateX(35deg)'}}
                 >
                    {data.map((items, indexs) => {
                        return (
                            <div key={indexs} style={{ display: 'flex' }}>
                                {items && items.length
                                    ? items.map((item, index) => {
                                        return (
                                            <div
                                                key={index}
                                                style={{
                                                    width: '2rem',
                                                    color: 'blue',
                                                    fontSize: `${scale * 20 * 0.8}px`,
                                                    lineHeight: '1.5rem',
                                                    transform: `translateY(${-item * 3}px)`,
                                                    color: `rgb(${jet(0, valuej1, item * 5)})`,
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
})