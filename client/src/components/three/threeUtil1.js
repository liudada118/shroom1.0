/**
 * threeUtil1.js - 框选换算工具（其中 3 个已搬进 SDK，本文件为它们留壳）
 *
 * 本文件有 35 个 import 方。搬包时**只搬走点阵渲染器真正用到的那 3 个**：
 *
 * | 函数 | 现在在哪 |
 * | :--- | :--- |
 * | `getPointCoordinate` | `@shroom/frontend/react/three/pointPick.js` |
 * | `checkRectangleIntersection` | 同上 |
 * | `checkRectIndex` | 同上 |
 * | `getPointCoordinateback` | 仍在本文件 |
 * | `getPointCoordinateWowback` | 仍在本文件 |
 * | `getPointCoordinateWowhead` | 仍在本文件 |
 *
 * 留在本文件的这 3 个只有旧场景组件在用，点阵渲染器不用，所以进包没有意义。
 * 它们和 `getPointCoordinate` 是复制粘贴关系，净差异只有 `point.position.x`
 * 那一行的偏移常量（`+100` / `-5600` / `+2200`）—— **合成一个带偏移参数的函数
 * 是另一件事**，会同时动到 35 个 import 方，记进积压。
 */

import * as THREE from "three";

export {
  checkRectIndex,
  checkRectangleIntersection,
  getPointCoordinate,
} from '@shroom/frontend/react/three/pointPick.js';

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
