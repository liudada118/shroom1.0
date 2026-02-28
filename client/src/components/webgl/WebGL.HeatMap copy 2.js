export class WebGLCanvas {
    constructor() {
        this.vertexShader = "\
        attribute vec4 a_Position;\
        uniform vec2 u_resolution;\
        uniform float u_maxClick;\
        uniform float u_minClick;\
        uniform float u_filterClick;\
        attribute float a_click;\
        attribute vec2 a_center;\
        attribute float a_radius;\
        varying vec2 v_center;\
        varying vec2 v_resolution;\
        varying float v_radius;\
        varying float v_maxClick;\
        varying float v_minClick;\
        varying float v_filterClick;\
        varying float v_click;\
        void main() {\
                gl_PointSize = a_radius * 2.0;\
                vec2 clipspace = a_center / u_resolution * 2.0 - 1.0;\
                gl_Position = vec4(clipspace * vec2(1, -1), 0, 1);\
                v_center = a_center;\
                v_resolution = u_resolution;\
                v_radius = a_radius - 1.0;\
                v_maxClick = u_maxClick;\
                v_minClick = u_minClick;\
                v_filterClick = u_filterClick;\
                v_click = a_click; \
        }";
        this.fragmentShader = "\
        precision mediump float;\
        varying vec2 v_center;\
        varying vec2 v_resolution;\
        varying float v_radius;\
        varying float v_maxClick;\
        varying float v_minClick;\
        varying float v_filterClick;\
        varying float v_click;\
        varying float v_groupIdx;\
        void main() {\
                vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0);\
                float x = gl_FragCoord.x;\
                float y = v_resolution[1] - gl_FragCoord.y;\
                float dx = v_center[0] - x;\
                float dy = v_center[1] - y;\
                float distance = sqrt(dx*dx + dy*dy);\
                float diff = v_radius-distance;\
                float currentPercent=0.95;\
                float blurFactory=0.55;\
                float pxAlpha=0.0;\
                if(v_maxClick>= v_click && v_click>= v_minClick){\
                    pxAlpha = (v_click-v_minClick)/(v_maxClick-v_minClick);\
                }\
                if(v_click>= v_maxClick){\
                    pxAlpha = 1.0;\
                }\
                if ( diff >  0.0 ) {\
                    if(diff > v_radius * blurFactory) {\
                        gl_FragColor = vec4(0,0,0,pxAlpha);\
                    } else {\
                        float p=diff/(v_radius*blurFactory);\
                        gl_FragColor = vec4(0,0,0,p*pxAlpha);\
                    }\
                } else {\
                    if ( diff >= 0.0 && diff <= 1.0 ){\
                    }\
                    else{\
                        gl_FragColor = vec4(0,0,0,0);\
                    }\
                }\
        }";
        this.vertexShader1 = "\
        attribute vec4 a_Position;\
        void main(void){\
            gl_Position = a_Position;\
        }";
        this.fragmentShader1 = `\
        precision mediump float;\
        uniform vec2 u_resolution;\
        uniform sampler2D u_Sampler;\
        vec3 getColorByPercent(float pct){\
            vec3 v3=vec3(0.0,0.0,pct);\

                  if(pct <= 0.00){\
        return vec3(0, 0, 0);\
    }else if(pct <= 0.08){\

        float t = (pct - 0.00)/(0.08 - 0.00);\
        return mix(vec3(0.255, 0.573, 0.996), vec3(0.286, 0.667, 1.000), t);\
    }else if(pct <= 0.17){\

        float t = (pct - 0.08)/(0.17 - 0.08);\
        return mix(vec3(0.286, 0.667, 1.000), vec3(0.318, 0.776, 1.000), t);\
    }else if(pct <= 0.25){\
        float t = (pct - 0.17)/(0.25 - 0.17);\
        return mix(vec3(0.318, 0.776, 1.000), vec3(0.302, 0.875, 0.961), t);\
    }else if(pct <= 0.33){\
        float t = (pct - 0.25)/(0.33 - 0.25);\
        return mix(vec3(0.302, 0.875, 0.961), vec3(0.204, 0.965, 0.859), t);\
    }else if(pct <= 0.42){\
        float t = (pct - 0.33)/(0.42 - 0.33);\
        return mix(vec3(0.204, 0.965, 0.859), vec3(0.424, 1.000, 0.725), t);\
    }else if(pct <= 0.50){\
        float t = (pct - 0.42)/(0.50 - 0.42);\
        return mix(vec3(0.424, 1.000, 0.725), vec3(0.773, 1.000, 0.545), t);\
    }else if(pct <= 0.58){\
        float t = (pct - 0.50)/(0.58 - 0.50);\
        return mix(vec3(0.773, 1.000, 0.545), vec3(0.992, 0.965, 0.333), t);\
    }else if(pct <= 0.67){\
        float t = (pct - 0.58)/(0.67 - 0.58);\
        return mix(vec3(0.992, 0.965, 0.333), vec3(1.000, 0.855, 0.255), t);\
    }else if(pct <= 0.75){\
        float t = (pct - 0.67)/(0.75 - 0.67);\
        return mix(vec3(1.000, 0.855, 0.255), vec3(1.000, 0.710, 0.290), t);\
    }else if(pct <= 0.83){\
        float t = (pct - 0.75)/(0.83 - 0.75);\
        return mix(vec3(1.000, 0.710, 0.290), vec3(1.000, 0.584, 0.333), t);\
    }else if(pct <= 0.92){\
        float t = (pct - 0.83)/(0.92 - 0.83);\
        return mix(vec3(1.000, 0.584, 0.333), vec3(1.000, 0.463, 0.396), t);\
    }else if(pct <= 1.00){\
        float t = (pct - 0.92)/(1.00 - 0.92);\
        return mix(vec3(1.000, 0.463, 0.396), vec3(1.000, 0.369, 0.439), t);\
    }else{\
        return vec3(1.000, 0.369, 0.439);\
    }\
            return v3;\
        }\
        void main(void){\
            vec4 c=texture2D(u_Sampler, vec2(gl_FragCoord.x/u_resolution[0],gl_FragCoord.y/u_resolution[1]));\
            float p_alpha=c[3];\
            if(p_alpha>0.08){\
                 gl_FragColor = vec4(getColorByPercent(p_alpha),1) ;\
            }\
        }`
    }


}



WebGLCanvas.prototype.bufferCuter = function (arr) {
    var buffers = [];
    var _cur;
    // 把arr按照长度每3000 分割一下
    _cur = arr.splice(0, 3000);
    while (_cur.length > 0) {
        buffers.push(_cur);
        _cur = arr.splice(0, 3000);
    }

    // 将每个3000数 转化为float数组
    for (var i in buffers) {
        var d = [];
        var j = 0;
        var groupIdx = 0;
        for (var _i in buffers[i]) {
            var pointData = buffers[i][_i];
            d[j++] = pointData[0];
            d[j++] = pointData[1];
            d[j++] = pointData[2];
        }
        buffers[i] = new Float32Array(d);


    }
    return buffers;

}
var tplCanvas = document.createElement("canvas");
var map = {}
// document.body.appendChild(tplCanvas)
WebGLCanvas.prototype.createTplCanvas = function (cfg, data ,index) {

    // var tplCanvas = document.createElement("canvas");
    // var tplCanvas = document.getElementById(cfg.class)
    // if(!map[index]) map[index] = document.createElement("canvas");
    // var tplCanvas = map[index]

    // glObj存储一些数据
    tplCanvas.glObj = {
        canvas: tplCanvas,
        data: data,
        cfg: cfg
    };

    // 设置高宽
    tplCanvas.width = cfg.width || 2048;
    tplCanvas.height = cfg.height || 1024;

    // webgl的context获取
    var gl = tplCanvas.glObj.gl = tplCanvas.getContext('webgl');
    // 设定canvas初始化的颜色
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // 设定canvas初始化时候的深度

    // 禁用深度测试
    gl.disable(gl.DEPTH_TEST);
    // 清除颜色缓冲区
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 顶点着色器和片段着色器的生成
    var v_shader = create_shader(gl, 'v', this.vertexShader);
    var f_shader = create_shader(gl, 'f', this.fragmentShader);

    var v_shader1 = create_shader(gl, 'v', this.vertexShader1);
    var f_shader1 = create_shader(gl, 'f', this.fragmentShader1);

    // 程序对象的生成和连接
    var programNode = tplCanvas.glObj.programNode = create_program(gl, v_shader, f_shader);
    gl.useProgram(programNode);



    // // 顶点着色器和片段着色器的生成
    // var v_shader1 = create_shader(gl, 'v', vs1.innerHTML);
    // var f_shader1 = create_shader(gl, 'f', fs1.innerHTML);

    // // 程序对象的生成和连接
    // var programNode1 = create_program(gl, v_shader1, f_shader1);




    // attributeLocation的获取

    gl.enable(gl.BLEND); //首先要启用混合
    gl.blendEquation(gl.FUNC_ADD); //相加
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); //源色和现有色的相加


    var resolutionLocation = tplCanvas.glObj.resolutionLocation = gl.getUniformLocation(programNode, "u_resolution");

    var centerLocation = tplCanvas.glObj.centerLocation = gl.getAttribLocation(programNode, "a_center");
    var radiusLocation = tplCanvas.glObj.radiusLocation = gl.getAttribLocation(programNode, "a_radius");
    var a_clickLocation = tplCanvas.glObj.a_clickLocation = gl.getAttribLocation(programNode, "a_click");

    var u_maxClickLocation = tplCanvas.glObj.u_maxClickLocation = gl.getUniformLocation(programNode, "u_maxClick");
    var u_minClickLocation = tplCanvas.glObj.u_minClickLocation = gl.getUniformLocation(programNode, "u_minClick");
    var u_filterClickLocation = tplCanvas.glObj.u_filterClickLocation = gl.getUniformLocation(programNode, "u_filterClick");




    // 将两个浮点数赋值着色器中对应的uniform变量
    gl.uniform2f(resolutionLocation, tplCanvas.width, tplCanvas.height);



    function draw() {

        // 将单个浮点数赋值着色器中对应的uniform变量
        gl.uniform1f(u_maxClickLocation, tplCanvas.glObj.cfg.max);
        gl.uniform1f(u_minClickLocation, tplCanvas.glObj.cfg.min);
        gl.uniform1f(u_filterClickLocation, tplCanvas.glObj.cfg.filter);


        // 设置顶点属性值
        gl.vertexAttrib1f(radiusLocation, tplCanvas.glObj.cfg.radius + 1);


        // 创建一个帧缓冲对象
        var fb = gl.createFramebuffer();


        // create an empty texture
        var tex = gl.createTexture();
        // 绑定材质
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // 指定二维纹理数据
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tplCanvas.width, tplCanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        // 设置绑定纹理对象的参数
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        // 绑定材质
        fb.texture = tex;

        // 创建一个只写缓冲区 在离屏渲染（FBO）中被用作附件。
        var depthBuffer = gl.createRenderbuffer();

        // webgl中有很多缓冲区  必须得先绑定目标   才能进行配置使用
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);

        // 用于为当前绑定的 Renderbuffer 分配存储空间，并设置其内部格式和尺寸。
        // 这一步决定了 Renderbuffer 将用于存储何种类型的数据，例如深度数据、模板数据或彩色数据。
        gl.renderbufferStorage(
            gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, tplCanvas.width, tplCanvas.height
        );


        // 绑定一个帧缓冲对象
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        // 将纹理对象附加到当前绑定的帧缓冲对象上(通常作为颜色附件)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

        // 用于将一个渲染缓冲对象附加到当前绑定的帧缓冲对象上，通常用于附加深度缓冲或者模板缓冲，因为渲染缓冲在只读性和性能上有一定优势
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);



        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
            alert("this combination of attachments does not work");
            return;
        }

        // 定义渲染输出区域
        gl.viewport(0, 0, tplCanvas.width, tplCanvas.height);







        var ATTRIBUTES = 3;
        for (var i in tplCanvas.glObj.data) {
            // 将每组热力图对象数据弄出
            var f32Arr = tplCanvas.glObj.data[i];

            var dataBuffer = f32Arr;
            var buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

            gl.bufferData(
                gl.ARRAY_BUFFER,
                dataBuffer,
                gl.STATIC_DRAW
            );


            // 启用顶点数组
            gl.enableVertexAttribArray(centerLocation);
            gl.enableVertexAttribArray(a_clickLocation);


            // 定义属性数组的读取规则
            gl.vertexAttribPointer(centerLocation, 2, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT * 0);
            gl.vertexAttribPointer(a_clickLocation, 1, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT * 2);

            gl.drawArrays(gl.POINTS, 0, f32Arr.length / ATTRIBUTES);


        }




        // 程序对象的生成和连接
        var programNode1 = tplCanvas.glObj.programNode1 = create_program(gl, v_shader1, f_shader1);
        gl.useProgram(programNode1);

        var a_Position = gl.getAttribLocation(programNode1, 'a_Position');

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);


        var resolutionLocation = gl.getUniformLocation(programNode1, "u_resolution");
        gl.uniform2f(resolutionLocation, tplCanvas.width, tplCanvas.height);



        var verts = [-1, -1, -1, 1,
            1, -1,
            1, 1
        ];
        var vertBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.deleteFramebuffer(fb);
    }
    draw();






    window.gl = gl;



    tplCanvas.resetCfg = function (cfg) {

        var gl = this.glObj.gl;
        gl.useProgram(programNode);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        tplCanvas.glObj.cfg = cfg;
        draw();


    }


    return tplCanvas;

};





WebGLCanvas.prototype.dataCuter = function (cfg, data, margin) {
    var result = [];

    // 将数据取整
    for (var i in data) {
        for (var j in data[i]) {
            data[i][j] = parseInt(data[i][j]);
        }
    };

    var _data = data.sort(function (a, b) {
        return a[1] - b[1];
    });
    var idx = 0;


    for (var i in data) {
        var p = data[i];
        var x = p[0];
        var y = p[1];
        var c = p[2];

        // 横向值
        var modY = y % cfg.height;

        // 纵向值
        var gp = Math.floor(y / cfg.height);
        if (!result[gp]) { result[gp] = [] }
        result[gp].push([x, y - gp * cfg.height, c]);
        if (cfg.height - modY < margin) {
            if (!result[gp + 1]) { result[gp + 1] = [] }
            result[gp + 1].push([x, y - (gp + 1) * cfg.height, c]);
        }

        if (modY < margin) {
            if (gp - 1 >= 0) {

                if (!result[gp - 1]) { result[gp - 1] = [] };
                result[gp - 1].push([x, cfg.height + modY, c]);
            }
        }


    }
    return result;


}

WebGLCanvas.prototype.getNearPower = function (num) {
    // var _vernier = 2;
    // while (_vernier < num) {
    //     _vernier = _vernier * 2;
    // }
    // return _vernier;
    return num
}


WebGLCanvas.prototype.render = function (cfg, data ,index) {

    cfg.width = this.getNearPower(cfg.width);
    cfg.height = this.getNearPower(cfg.height);

    var canvasQueue = [];
    var cutedData = this.dataCuter(cfg, data, 0);

    for (var i in cutedData) {

        var bufferChip = this.bufferCuter(cutedData[i]);
        var canvas = this.createTplCanvas(cfg, bufferChip,index);
        canvasQueue.push(canvas);
    }
    return canvasQueue;

}

WebGLCanvas.prototype.reset = function (cfg, canvasArr) {
    for (var i in canvasArr) {
        canvasArr[i].resetCfg(cfg)
    }
}

/**
 *
 * @param {*} dataArr 多组genData生成的数据集合
 * @param {*} param1 每个小画布尺寸
 * @returns
 */
export function genAllData(dataArr, { canvasWidth = 512, canvasHeight = 1024 }) {
  let heightIndex = 0, newArr = []

  for (let index = 0; index < dataArr.length; index++) {
      const bodyArr = dataArr[index][0]
      const leftArr = dataArr[index][1]
      const rightArr = dataArr[index][2]
      {
          const height = 24, width = 24, order = 2, interp1 = 1, interp2 = 2
          const arr = bodyArr

          let resArr = arr
          resArr = addSide(
              resArr,
              height,
              width,
              order,
              order,
              1
          );
          const interpArr = interpSmall(resArr, height + order * 2, width + order * 2, interp1, interp2)

          let resData = interpArr

          let dataWidth = 28, dataHeight = 56, canvas = { width: canvasWidth, height: canvasHeight }
          for (let i = 0; i < dataHeight; i++) {
              for (let j = 0; j < dataWidth; j++) {
                  let obj = {}
                  // obj.y = i * canvas.width / dataWidth
                  // obj.x = j * canvas.height / dataHeight
                  // obj.value = resData[i * dataWidth + j]
                  // data.push(obj)

                  newArr.push([j * (canvas.width / dataWidth), canvasHeight * ((index) * 2) + i * (canvas.height / dataHeight), resData[i * dataWidth + j]])
              }

          }

      }

      {
          const height = 4, width = 4, order = 2, interp1 = 2, interp2 = 8
          const arr = leftArr
          let resArr = arr
          resArr = addSide(
              resArr,
              height,
              width,
              order,
              order,
              1
          );
          const interpArr = interp(resArr, height + order * 2, width + order * 2, interp1, interp2)

          let resData = interpArr


          const arr1 = rightArr
          let resArr1 = arr1
          resArr1 = addSide(
              resArr1,
              height,
              width,
              order,
              order,
              1
          );
          const interpArr1 = interp(resArr1, height + order * 2, width + order * 2, interp1, interp2)

          let resData1 = interpArr1

          let dataWidth = (width + order * 2) * interp1, dataHeight = (height + order * 2) * interp2, canvas = { width: canvasWidth / 2, height: canvasHeight }

          for (let i = 0; i < dataHeight; i++) {
              for (let j = 0; j < dataWidth; j++) {


                  // let obj = {}
                  // obj.y = i * canvas.width / dataWidth
                  // obj.x = j * canvas.height / dataHeight
                  // obj.value = resData[i * dataWidth + j]
                  // data.push(obj)
                  const data =  resData[i * dataWidth + j] ? resData[i * dataWidth + j]  : 0
                  newArr.push([j * (canvas.width / dataWidth), canvasHeight * ((index + 1) * 2 - 1) + i * (canvas.height / dataHeight), data])

              }

          }



          for (let i = 0; i < dataHeight; i++) {
              for (let j = 0; j < dataWidth; j++) {


                  // let obj = {}
                  // obj.y = i * canvas.width / dataWidth
                  // obj.x = j * canvas.height / dataHeight
                  // obj.value = resData1[i * dataWidth + j]
                  // data.push(obj)
                  const data = resData1[i * dataWidth + j] ? resData1[i * dataWidth + j]  : 0
                  newArr.push([canvas.width + j * (canvas.width / dataWidth), canvasHeight * ((index + 1) * 2 - 1) + i * (canvas.height / dataHeight), data])

              }

          }




      }
  }
  return newArr
}

/**
 *
 * @param {*} arr 原始数据
 * @returns 每个部位数据
 */
export function genData(arr) {
  const props = {}
  props.data = arr
  // props.data = new Array(1024).fill(50)
  let handLeft = props.data.slice(0, 16)

  let handRight = props.data.slice(16, 32)

  // let body = props.data.slice(32, 32 + 24 * 24)
  // let handLeft = new Array(16).fill(100)
  // let handRight = new Array(16).fill(100)
  // const body = new Array(24*24).fill(100)


  for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 4; j++) {
          [handLeft[i * 4 + j], handLeft[(3 - i) * 4 + j]] = [handLeft[(3 - i) * 4 + j], handLeft[i * 4 + j],]
      }
  }
  let neck = props.data.slice(32, 32 + 24 * 5)
  let back = props.data.slice(32 + 24 * 5, 32 + 24 * 14)
  let sit = props.data.slice(32 + 24 * 14, 32 + 24 * 24)

  const neckMax = Math.max(...neck)
  const backMax = Math.max(...back)
  const sitMax = Math.max(...sit)
  const leftMax = Math.max(...handLeft)
  const rightMax = Math.max(...handRight)

  // handLeft = handLeft.map((a) => Math.floor(a * leftMax / backMax))
  // handLeft = handLeft.map((a) => a * leftMax / backMax)
  handLeft = changeArrValue(handLeft , leftMax , sitMax)
  handRight =  changeArrValue(handRight , rightMax , sitMax)
  neck =  changeArrValue(neck , neckMax , sitMax)
  back =  changeArrValue(back , backMax , sitMax)
  sit =  changeArrValue(sit , sitMax , sitMax , 'sit')

  const body = [...neck, ...back, ...sit,]

  for(let i = 0 ; i < 24; i++){
    for(let j = 0 ; j < 12; j++){
      [body[i*24 + j] ,body[i*24 + 23-j]] =  [body[i*24 + 23-j],body[i*24 + j]]
    }
  }
  const filterArr = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 17], [0, 18], [0, 19], [0, 20], [0, 21], [0, 22], [0, 23], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 17], [1, 18], [1, 19], [1, 20], [1, 21], [1, 22], [1, 23], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 16], [2, 17], [2, 18], [2, 19], [2, 20], [2, 21], [2, 22], [2, 23], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 18], [3, 19], [3, 20], [3, 21], [3, 22], [3, 23], [4, 0], [4, 1], [4, 22], [4, 23], [9, 0], [9, 1], [9, 22], [9, 23], [10, 0], [10, 1], [10, 2], [10, 21], [10, 22], [10, 23], [11, 0], [11, 1], [11, 2], [11, 3], [11, 20], [11, 21], [11, 22], [11, 23], [12, 0], [12, 1], [12, 21], [12, 22], [12, 23], [13, 0], [13, 1], [13, 21], [13, 22], [13, 23], [14, 0], [14, 22], [14, 23], [15, 22], [15, 23], [16, 23], [17, 23], [18, 11], [18, 12], [18, 23], [19, 11], [19, 12], [19, 23], [20, 11], [20, 12], [20, 23], [21, 10], [21, 11], [21, 12], [21, 13], [21, 23], [22, 0], [22, 10], [22, 11], [22, 12], [22, 13], [22, 23], [23, 0], [23, 9], [23, 10], [23, 11], [23, 12], [23, 13], [23, 14], [23, 22], [23, 23], [18, 10], [19, 10], [20, 10], [18, 13], [19, 13], [20, 13], [0, 16], [23, 8], [22, 9], [21, 9], [20, 9], [19, 9], [18, 9], [20, 8], [21, 8], [22, 8], [20, 14], [21, 14], [22, 14]]


  for (let i = 0; i < filterArr.length; i++) {
      const index = filterArr[i][0] * 24 + filterArr[i][1]
      body[index] = 0
      // newArr1[index] = 0
      // newBody[index] = 0
  }
  return [body, handLeft, handRight]
}


function addSide(arr, width, height, wnum, hnum, sideNum) {
  const narr = new Array(height);
  const res = [];
  for (let i = 0; i < height; i++) {
      narr[i] = [];

      for (let j = 0; j < width; j++) {
          if (j == 0) {
              narr[i].push(
                  ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1),
                  arr[i * width + j]
              );
          } else if (j == width - 1) {
              narr[i].push(
                  arr[i * width + j],
                  ...new Array(wnum).fill(sideNum >= 0 ? sideNum : 1)
              );
          } else {
              narr[i].push(arr[i * width + j]);
          }
      }
  }
  for (let i = 0; i < height; i++) {
      res.push(...narr[i]);
  }

  return [
      ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
      ...res,
      ...new Array(hnum * (width + 2 * wnum)).fill(sideNum >= 0 ? sideNum : 1),
  ];
}

function interp(smallMat, width, height, interp1, interp2) {

  const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
  for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
          const realValue = smallMat[i * width + j]
          const rowValue = smallMat[i * width + j + 1]  ? smallMat[i * width + j + 1]  : 0
          const colValue = smallMat[(i + 1) * width + j]  ? smallMat[(i + 1) * width + j]  : 0
          bigMat[(width * interp1) * i * interp2 + (j * interp1)
          ] = smallMat[i * width + j]
          // for (let k = 0; k < interp1; k++) {
          //   // for (let z = 0; z < interp2; z++) {
          //   //   bigMat[(width * interp1) * (i * interp2 + k) + ((j * interp1) + z)
          //   //   ] = smallMat[i * width + j] * 10
          //   // }
          // }

          // for (let k = 0; k < interp2; k++) {
          //   bigMat[(width * interp1) * (i * interp2 + k) + ((j * interp1))] = realValue + (colValue - realValue) * (k) / interp2
          // }
          for (let k = 0; k < interp1; k++) {
              bigMat[(width * interp1) * (i * interp2) + ((j * interp1 + k))] = realValue + (rowValue - realValue) * (k) / interp1
          }
      }
  }

  const newWidth = width * interp1

  for (let i = 0; i < height; i++) {
      for (let j = 0; j < newWidth; j++) {
          const realValue = bigMat[i * interp2 * newWidth + j]
          // const rowValue = bigMat[i * width + j + 1] * 10 ? bigMat[i * width + j + 1] * 10 : 0
          // const colValue = bigMat[(i + 1) * width + j] * 10 ? bigMat[(i + 1) * width + j] * 10 : 0
          const colValue = bigMat[((i + 1) * interp2) * newWidth + j] //? bigMat[(((i + 1) * interp2) + 1) * newWidth + j] : 0
          for (let k = 0; k < interp2; k++) {
              bigMat[newWidth * (i * interp2 + k) + ((j))] = realValue + (colValue - realValue) * (k) / interp2
          }
      }
  }
  // for(let i = 0 ; i < width * interp1 ; i ++){
  //   for(let j = 0 ; j < width * interp1 ; j ++){

  //   }
  // }
  return bigMat
}



function interpSmall(smallMat, width, height, interp1, interp2) {

  const bigMat = new Array((width * interp1) * (height * interp2)).fill(0)
  for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
          bigMat[(width * interp1) * i * interp2 + (j * interp1)] = smallMat[i * width + j]
          bigMat[(width * interp1) * (i * interp2 + 1) + (j * interp1)] = smallMat[i * width + j]
          if (interp2 > 2) {
              bigMat[(width * interp1) * (i * interp2 + 2) + (j * interp1)] = smallMat[i * width + j]
              bigMat[(width * interp1) * (i * interp2 + 3) + (j * interp1)] = smallMat[i * width + j]
          }


          // for(let k = 0 ; k < interp2 ; k++){
          //     const diff = smallMat[(i + 1) * width + j] ? smallMat[(i + 1) * width + j] - smallMat[i * width + j] : 0
          //     bigMat[(width * interp1) * (i * interp2 + k) + (j * interp1)] = (smallMat[i * width + j] + diff * (k+1) / interp2 )* 5
          //     // bigMat[(width * interp1) * (i * interp2 + k) + (j * interp1)] = (smallMat[i * width + j] + smallMat[(i + 1) * width + j] ? smallMat[(i + 1) * width + j] :  ) * (k+1) / interp2 * 5
          // // bigMat[(width * interp1) * (i * interp2 + 1) + (j * interp1)] = smallMat[i * width + j] * 10
          // }
      }
  }

  // console.log(bigMat.length)
  return bigMat
}



































// 生成着色器的函数
function create_shader(gl, type, source) {
    // 用来保存着色器的变量
    var shader;
    switch (type) {
        // 顶点着色器的时候
        case 'v':
            shader = gl.createShader(gl.VERTEX_SHADER);
            break;

        // 片段着色器的时候
        case 'f':
            shader = gl.createShader(gl.FRAGMENT_SHADER);
            break;
        default:
            return;
    }

    // 将标签中的代码分配给生成的着色器
    gl.shaderSource(shader, source);

    // 编译着色器
    gl.compileShader(shader);

    // 判断一下着色器是否编译成功
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {

        // 编译成功，则返回着色器
        return shader;
    } else {

        // 编译失败，弹出错误消息
        alert(gl.getShaderInfoLog(shader));
    }
}

// 程序对象的生成和着色器连接的函数
function create_program(gl, vs, fs) {
    // 程序对象的生成
    var program = gl.createProgram();

    // 向程序对象里分配着色器
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);

    // 将着色器连接
    gl.linkProgram(program);

    // 判断着色器的连接是否成功
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {

        // 成功的话，将程序对象设置为有效
        //gl.useProgram(program);

        // 返回程序对象
        return program;
    } else {

        // 如果失败，弹出错误信息
        alert(gl.getProgramInfoLog(program));
    }
}

// 生成VBO的函数
// function create_vbo(data) {
//     // 生成缓存对象
//     var vbo = gl.createBuffer();

//     // 绑定缓存
//     gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

//     // 向缓存中写入数据
//     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

//     // 将绑定的缓存设为无效
//     gl.bindBuffer(gl.ARRAY_BUFFER, null);

//     // 返回生成的VBO
//     return vbo;
// }


function changeArrValue(arr , arrMax ,backMax , name ){
  return arr
    if(!arrMax){
        return arr
    }
    const props = name ? 1 : 0.8
    return arr.map((a) => Math.floor(a *backMax/  arrMax*props ))
}