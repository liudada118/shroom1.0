import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./HumanBodyOptimized.jsx", import.meta.url)),
  "utf8",
);

describe("human body crystal material", () => {
  it("treats the slider value as shell transparency", () => {
    expect(source.match(/shellAlpha = clamp\(1\.0 - uTransparency, 0\.05, 0\.95\)/g)).toHaveLength(1);
    expect(source).not.toContain("uOpacity");
    expect(source).not.toContain("fresnel * 0.15");
  });

  it("keeps a restrained color rim on a front-facing shell", () => {
    expect(source.match(/fresnel \* 0\.12/g)).toHaveLength(1);
    expect(source).toContain("fragmentShader: crystalShellFragmentShader");
    expect(source).toContain("side: THREE.FrontSide");
    expect(source).toContain("depthWrite: false");
  });

  it("renders pressure in explicit back-then-front passes without shell depth occlusion", () => {
    const heatmapMaterialBlock = source.slice(
      source.indexOf("const shaderMaterial = new THREE.ShaderMaterial"),
      source.indexOf("const nearest12Material = new THREE.ShaderMaterial"),
    );
    const exactOverlayMaterialBlock = source.slice(
      source.indexOf("const crystalOverlayMaterial = new THREE.ShaderMaterial"),
      source.indexOf("const crystalOverlayFrontMaterial = crystalOverlayMaterial.clone()"),
    );
    expect(source).toContain("exactCrystalHeatOverlayFragmentShader");
    expect(source).toContain("nearest12CrystalHeatOverlayFragmentShader");
    expect(source).toMatch(/const exactCrystalHeatOverlayFragmentShader = `[\s\S]*?uniform float uHeatAlpha;/);
    expect(source).toMatch(/const nearest12CrystalHeatOverlayFragmentShader = `[\s\S]*?uniform float uHeatAlpha;/);
    expect(source.match(/if \(heatVisibility < 0\.01\) discard;/g)).toHaveLength(2);
    expect(source.match(/vec4\(heatColor\(heat\), heatVisibility \* uHeatAlpha\)/g)).toHaveLength(2);
    expect(source.match(/uHeatAlpha: \{ value: 0\.35 \}/g)).toHaveLength(2);
    expect(heatmapMaterialBlock).not.toContain("uHeatAlpha");
    expect(exactOverlayMaterialBlock).toContain("uHeatAlpha: { value: 0.35 }");
    expect(source.match(/uniforms\.uHeatAlpha\.value = 0\.65/g)).toHaveLength(2);
    expect(source.match(/depthTest: false/g)).toHaveLength(2);
    expect(source.match(/side: THREE\.BackSide/g)).toHaveLength(2);
    expect(source.match(/\.side = THREE\.FrontSide/g)).toHaveLength(2);
    expect(source).toContain("overlayMesh.renderOrder = sideIndex === 0 ? 8 : 10");
    expect(source).toContain('mesh.renderOrder = mode === "crystal" ? 9 : 0');
    expect(source).not.toContain("gl_FrontFacing");
  });

  it("shares source geometry and keeps overlay meshes outside the raycast list", () => {
    expect(source).toContain("new THREE.Mesh(\n                sourceMesh.geometry");
    expect(source).toContain("crystalOverlayMeshesRef.current.push(overlayMeshes)");
    expect(source).toContain("raycaster.intersectObjects(bodyMeshesRef.current, false)");
    expect(source).not.toContain("bodyMeshesRef.current.push(overlayMesh)");
  });
});
