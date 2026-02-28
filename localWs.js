const WebSocket = require("ws");

function colOrSendData(jsonData) {
    // console.log(JSON.stringify(JSON.parse(jsonData).sitData) , 'jsonData')






    server.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
        }
    });

}

let server = new WebSocket.Server({ port: 19999 });

function zeroLineMatrix(arr, matrixLength, max, min) {
    let wsPointData = [...arr];
    let colArr = [],
        rowArr = [];
    for (let i = 0; i < matrixLength; i++) {
        let coltotal = 0,
            rowtotal = 0;
        for (let j = 0; j < matrixLength; j++) {
            coltotal += wsPointData[j * matrixLength + i];
            rowtotal += wsPointData[i * matrixLength + j];
        }
        colArr.push(coltotal);
        rowArr.push(rowtotal);
    }

    for (let i = 1; i < matrixLength - 1; i++) {
        if (rowArr[i + 1] > 100 && rowArr[i] < 40 && rowArr[i - 1] > 100) {
            console.log(i , 'rowArr')
            for (let j = 0; j < matrixLength; j++) {
                wsPointData[i * matrixLength + j] =
                    (wsPointData[(i - 1) * matrixLength + j] + wsPointData[(i + 1) * matrixLength + j]) / 2;
            }
        }
    }

    for (let i = 1; i < matrixLength - 1; i++) {
        if (colArr[i + 1] > 100 && colArr[i] < 40 && colArr[i - 1] > 100) {
            console.log(i , 'colArr')
            for (let j = 0; j < matrixLength; j++) {
                wsPointData[j * matrixLength + i] = (wsPointData[(j) * matrixLength + i - 1] + wsPointData[(j) * matrixLength + i + 1]) / 2;
            }
        }
    }
    return wsPointData;
}

setInterval(() => {
    let pointArr = []
    for (let i = 0; i < 64; i++) {
        for (let j = 0; j < 64; j++) {
            if (i % 2 == 0 || j % 2 == 0) {
                pointArr.push(20)
            } else {
                pointArr.push(0)
            }

        }
    }
    pointArr = zeroLineMatrix(pointArr , 64)
    console.log(pointArr)
    let jsonData = JSON.stringify({ sitData: pointArr, })
    colOrSendData(jsonData)
}, 100);