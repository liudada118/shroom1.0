import * as THREE from "three";

export function getPointCoordinate({ particles, camera, position , axis1 , angle1 }) {
    const positions = particles.geometry.attributes.position;

    const screenCoordinates = [];
    const dataArr = [0, positions.count - 1]
    for (let i = 0; i < dataArr.length; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positions, dataArr[i]); // 获取顶点的世界坐标
        const geometry = new THREE.BufferGeometry();
        const vertices = new THREE.Vector3(vertex.x, vertex.y, vertex.z)



        // 旋转角度
        let center = new THREE.Vector3(vertex.x, vertex.y, 0);
        const newVertices = vertices.clone()
        // console.log(center)
        newVertices.sub(center);
        const axis = axis1 ? new THREE.Vector3(...axis1) : new THREE.Vector3(1, 0, 0); // 旋转轴，这里使用 Y 轴作为示例
        const angle = angle1 ? angle1 : particles.rotation.x; // 旋转角度，这里使用 90 度作为示例

        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        newVertices.applyQuaternion(quaternion);
        newVertices.add(center);

        // console.log(newVertices)

        // console.log(newVertices, 'vertices') 
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const material = new THREE.PointsMaterial({ color: 0xff0000 });
        const point = new THREE.Points(geometry, material);

        point.scale.x = particles.scale.x;
        point.scale.y = particles.scale.y;
        point.scale.z = particles.scale.z;

        if (i == 0) {
            point.position.x = particles.position.x + position.x + vertices.x * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        } else {
            point.position.x = particles.position.x + position.x + vertices.x * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        }

        const vector = new THREE.Vector3();
        var widthHalf = 0.5 * window.innerWidth;  //此处应使用画布长和宽
        var heightHalf = 0.5 * window.innerHeight;

        point.updateMatrixWorld(); // 函数updateMatrix()和updateMatrixWorld(force)将根据position，rotation或quaternion，scale参数更新matrix和matrixWorld。updateMatrixWorld还会更新所有后代元素的matrixWorld，如果force值为真则调用者本身的matrixWorldNeedsUpdate值为真。

        //getPositionFromMatrix()方法已经删除,使用setFromMatrixPosition()替换, setFromMatrixPosition方法将返回从矩阵中的元素得到的新的向量值的向量
        vector.setFromMatrixPosition(point.matrixWorld);

        //projectOnVector方法在将当前三维向量(x,y,z)投影一个向量到另一个向量,参数vector(x,y,z). 
        vector.project(camera);

        vector.x = (vector.x * widthHalf) + widthHalf;
        vector.y = -(vector.y * heightHalf) + heightHalf;
        // console.log(vector.x, vector.y,)
        screenCoordinates.push(vector)
    }
    return screenCoordinates
}

export function getPointCoordinateback({ particles, camera, position, width }) {
    const positions = particles.geometry.attributes.position;

    const screenCoordinates = [];
    const dataArr = [0, positions.count - 1]
    for (let i = 0; i < dataArr.length; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positions, dataArr[i]); // 获取顶点的世界坐标
        const geometry = new THREE.BufferGeometry();
        const vertices = new THREE.Vector3(vertex.x, vertex.y, vertex.z)



        // 旋转角度
        let center = new THREE.Vector3(vertex.x, vertex.y, 0);
        const newVertices = vertices.clone()
        // console.log(center)
        newVertices.sub(center);
        const axis = new THREE.Vector3(1, 0, 0); // 旋转轴，这里使用 Y 轴作为示例
        const angle = particles.rotation.x; // 旋转角度，这里使用 90 度作为示例

        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        newVertices.applyQuaternion(quaternion);
        newVertices.add(center);

        // console.log(newVertices)

        // console.log(newVertices, 'vertices') 
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const material = new THREE.PointsMaterial({ color: 0xff0000 });
        const point = new THREE.Points(geometry, material);

        point.scale.x = particles.scale.x;
        point.scale.y = particles.scale.y;
        point.scale.z = particles.scale.z;

        if (i == 0) {
            point.position.x = particles.position.x + position.x - (vertices.x + 100) * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        } else {
            point.position.x = particles.position.x + position.x - (vertices.x + 100) * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        }

        const vector = new THREE.Vector3();
        var widthHalf = 0.5 * window.innerWidth;  //此处应使用画布长和宽
        var heightHalf = 0.5 * window.innerHeight;

        point.updateMatrixWorld(); // 函数updateMatrix()和updateMatrixWorld(force)将根据position，rotation或quaternion，scale参数更新matrix和matrixWorld。updateMatrixWorld还会更新所有后代元素的matrixWorld，如果force值为真则调用者本身的matrixWorldNeedsUpdate值为真。

        //getPositionFromMatrix()方法已经删除,使用setFromMatrixPosition()替换, setFromMatrixPosition方法将返回从矩阵中的元素得到的新的向量值的向量
        vector.setFromMatrixPosition(point.matrixWorld);

        //projectOnVector方法在将当前三维向量(x,y,z)投影一个向量到另一个向量,参数vector(x,y,z). 
        vector.project(camera);

        vector.x = (vector.x * widthHalf) + widthHalf;
        vector.y = -(vector.y * heightHalf) + heightHalf;
        // console.log(vector.x, vector.y,)
        screenCoordinates.push(vector)
    }
    return screenCoordinates
}

export function getPointCoordinateWowback({ particles, camera, position, width }) {
    const positions = particles.geometry.attributes.position;

    const screenCoordinates = [];
    const dataArr = [0, positions.count - 1]
    for (let i = 0; i < dataArr.length; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positions, dataArr[i]); // 获取顶点的世界坐标
        const geometry = new THREE.BufferGeometry();
        const vertices = new THREE.Vector3(vertex.x, vertex.y, vertex.z)



        // 旋转角度
        let center = new THREE.Vector3(vertex.x, vertex.y, 0);
        const newVertices = vertices.clone()
        // console.log(center)
        newVertices.sub(center);
        const axis = new THREE.Vector3(1, 0, 0); // 旋转轴，这里使用 Y 轴作为示例
        const angle = particles.rotation.x; // 旋转角度，这里使用 90 度作为示例

        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        newVertices.applyQuaternion(quaternion);
        newVertices.add(center);

        // console.log(newVertices)

        // console.log(newVertices, 'vertices') 
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const material = new THREE.PointsMaterial({ color: 0xff0000 });
        const point = new THREE.Points(geometry, material);

        point.scale.x = particles.scale.x;
        point.scale.y = particles.scale.y;
        point.scale.z = particles.scale.z;

        if (i == 0) {
            point.position.x = particles.position.x + position.x - (vertices.x - 5600) * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        } else {
            point.position.x = particles.position.x + position.x - (vertices.x - 5600) * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        }

        const vector = new THREE.Vector3();
        var widthHalf = 0.5 * window.innerWidth;  //此处应使用画布长和宽
        var heightHalf = 0.5 * window.innerHeight;

        point.updateMatrixWorld(); // 函数updateMatrix()和updateMatrixWorld(force)将根据position，rotation或quaternion，scale参数更新matrix和matrixWorld。updateMatrixWorld还会更新所有后代元素的matrixWorld，如果force值为真则调用者本身的matrixWorldNeedsUpdate值为真。

        //getPositionFromMatrix()方法已经删除,使用setFromMatrixPosition()替换, setFromMatrixPosition方法将返回从矩阵中的元素得到的新的向量值的向量
        vector.setFromMatrixPosition(point.matrixWorld);

        //projectOnVector方法在将当前三维向量(x,y,z)投影一个向量到另一个向量,参数vector(x,y,z). 
        vector.project(camera);

        vector.x = (vector.x * widthHalf) + widthHalf;
        vector.y = -(vector.y * heightHalf) + heightHalf;
        // console.log(vector.x, vector.y,)
        screenCoordinates.push(vector)
    }
    return screenCoordinates
}

export function getPointCoordinateWowhead({ particles, camera, position, width }) {
    const positions = particles.geometry.attributes.position;

    const screenCoordinates = [];

    // 获取矩阵首位点的index
    const dataArr = [0, positions.count - 1]
    for (let i = 0; i < dataArr.length; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positions, dataArr[i]); // 获取顶点的世界坐标
        const geometry = new THREE.BufferGeometry();
        const vertices = new THREE.Vector3(vertex.x, vertex.y, vertex.z)



        // 旋转角度
        let center = new THREE.Vector3(vertex.x, vertex.y, 0);
        const newVertices = vertices.clone()
        // console.log(center)
        // 向量减法  保留z轴坐标
        newVertices.sub(center);
        const axis = new THREE.Vector3(1, 0, 0); // 旋转轴，这里使用 Y 轴作为示例
        const angle = particles.rotation.x; // 旋转角度，这里使用 90 度作为示例

        // 该方法将给定的轴（axis）和角度（angle）转换为四元数，并存储在调用的 quaternion 对象中。四元数是一种高效且无奇异点的方式来表示旋转，用于避免欧拉角带来的万向锁问题。
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        // 一个向量绕旋转轴旋转指定角度。
        newVertices.applyQuaternion(quaternion);
        // 加上 x y 坐标
        newVertices.add(center);

        // console.log(newVertices)

        // console.log(newVertices, 'vertices') 
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const material = new THREE.PointsMaterial({ color: 0xff0000 });
        const point = new THREE.Points(geometry, material);

        point.scale.x = particles.scale.x;
        point.scale.y = particles.scale.y;
        point.scale.z = particles.scale.z;

        if (i == 0) {
            point.position.x = particles.position.x + position.x - (vertices.x) * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        } else {
            point.position.x = particles.position.x + position.x - (vertices.x + 2200) * particles.scale.x
            point.position.y = particles.position.y + position.y + (newVertices.y - vertices.y + 780) * particles.scale.y
            point.position.z = particles.position.z + position.z + vertices.z * particles.scale.z + (newVertices.z - vertices.z) * particles.scale.z

        }

        const vector = new THREE.Vector3();
        var widthHalf = 0.5 * window.innerWidth;  //此处应使用画布长和宽
        var heightHalf = 0.5 * window.innerHeight;

        point.updateMatrixWorld(); // 函数updateMatrix()和updateMatrixWorld(force)将根据position，rotation或quaternion，scale参数更新matrix和matrixWorld。updateMatrixWorld还会更新所有后代元素的matrixWorld，如果force值为真则调用者本身的matrixWorldNeedsUpdate值为真。

        //getPositionFromMatrix()方法已经删除,使用setFromMatrixPosition()替换, setFromMatrixPosition方法将返回从矩阵中的元素得到的新的向量值的向量
        vector.setFromMatrixPosition(point.matrixWorld);

        //projectOnVector方法在将当前三维向量(x,y,z)投影一个向量到另一个向量,参数vector(x,y,z). 
        vector.project(camera);

        vector.x = (vector.x * widthHalf) + widthHalf;
        vector.y = -(vector.y * heightHalf) + heightHalf;
        // console.log(vector.x, vector.y,)
        screenCoordinates.push(vector)
    }
    return screenCoordinates
}


export function checkRectangleIntersection(rect1, rect2) {
    const [x1_1, y1_1, x2_1, y2_1] = rect1;
    const [x1_2, y1_2, x2_2, y2_2] = rect2;

    if (x1_1 < x2_2 && x2_1 > x1_2 && y1_1 < y2_2 && y2_1 > y1_2) {
        const intersection = [
            Math.max(x1_1, x1_2),
            Math.max(y1_1, y1_2),
            Math.min(x2_1, x2_2),
            Math.min(y2_1, y2_2)
        ];
        return intersection;
    } else {
        return null;
    }
}

export function checkRectIndex(rectmax, rectmin, width, height) {

    const [x1_1, y1_1, x2_1, y2_1] = rectmax;
    const [x1_2, y1_2, x2_2, y2_2] = rectmin;
    const rectHeight = y2_1 - y1_1
    const rectWidth = x2_1 - x1_1
    const startPointX = (x1_2 - x1_1) / rectWidth * width
    const pointLengthX = (x2_2 - x1_1) / rectWidth * width
    const startPointY = (y1_2 - y1_1) / rectHeight * height
    const pointLengthY = (y2_2 - y1_1) / rectHeight * height
    // console.log(rectmin, 'rectmin')
    return [startPointX, pointLengthX, startPointY, pointLengthY].map((a) =>  Math.round(a))
    // console.log(startPointX,pointLengthX,startPointY,pointLengthY)
}