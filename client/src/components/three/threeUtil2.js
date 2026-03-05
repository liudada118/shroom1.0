import * as THREE from "three";

export function getPointCoordinate1({ particles, camera, position }) {
    const positions = particles.geometry.attributes.position;
    console.log(particles.position, particles.scale, particles.rotation, positions)
    const screenCoordinates = [];
    const dataArr = [0, positions.count - 1]
    for (let i = 0; i < dataArr.length; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positions, dataArr[i]); // 获取顶点的世界坐标
        const geometry = new THREE.BufferGeometry();
        const vertices = new THREE.Vector3(vertex.x, vertex.y, vertex.z)

        console.log(vertices)

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
            point.position.x = 1 + position.x + vertices.x * 0.0062
            point.position.y = 105 + position.y + (newVertices.y - vertices.y) * 0.0062
            point.position.z = 123 + position.z + vertices.z * 0.0062 + (newVertices.z - vertices.z) * 0.0062

        } else {
            point.position.x = 1 + position.x + vertices.x * 0.0062
            point.position.y = 105 + position.y + (newVertices.y - vertices.y) * 0.0062
            point.position.z = 123 + position.z + vertices.z * 0.0062 + (newVertices.z - vertices.z) * 0.0062

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