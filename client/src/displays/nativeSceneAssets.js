/** 原生展示和入口预览共用资源地址；回退资源只在主资源加载失败后使用。 */
export const NATIVE_SCENE_ASSETS = Object.freeze({
  robot1: { url: './model/jiqirenGggg.fbx', loader: 'fbx', rotation: [-Math.PI / 2, 0, 0], viewDirection: [0, 100, 1] },
  robotSY: { url: './model/g-robot.fbx', loader: 'fbx', rotation: [-Math.PI / 2, 0, 0], viewDirection: [0, 100, 1] },
  robotLCF: { url: './model/robot04_marge.fbx', loader: 'fbx', rotation: [-Math.PI / 2, -Math.PI / 2, 0], viewDirection: [0, 100, 1] },
  wholeChair: { url: './model/0717.fbx', loader: 'fbx', rotation: [0, 0, 0], viewDirection: [0, 200, 300],
    fallback: { url: './model/chair3.glb', loader: 'gltf', rotation: [0, -Math.PI / 2, 0] } },
  carQX: { url: './model/0717.fbx', loader: 'fbx', rotation: [0, 0, 0], viewDirection: [0, 200, 300] },
  minzhen: { url: './model/minzhen/chair.gltf', loader: 'gltf', rotation: [0, Math.PI / 2, 0], viewDirection: [0, 200, 300],
    fallback: { url: './model/chair3.glb', loader: 'gltf', rotation: [0, Math.PI / 2, 0] } },
  humanBodyOptimized: { url: './model/human3-low.glb', loader: 'gltf', rotation: [0, 0, 0],
    fallback: { url: './model/human3.glb', loader: 'gltf', rotation: [0, 0, 0] } },
});

/** 与 foot.jsx 的双足底图平面一致；预览仅采样透明轮廓，不生成压力数据。 */
export const FOOT_SCENE_PLANES = Object.freeze([
  { name: 'left', url: './footleft.png', x: -10, width: 35, height: 35 },
  { name: 'right', url: './foot.png', x: 10, width: 35, height: 35 },
]);
