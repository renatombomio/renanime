import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

export default function ShaderGradientBackground() {
  return (
    <div className="shader-gradient" aria-hidden="true">
      <ShaderGradientCanvas
        style={{ position: "absolute", inset: 0 }}
        pixelDensity={1}
        fov={45}
        lazyLoad
      >
        <ShaderGradient
          animate="on"
          type="plane"
          shader="defaults"
          color1="#B20710"
          color2="#050505"
          color3="#8F260F"
          uDensity={1.4}
          uFrequency={5.5}
          uSpeed={0.4}
          uStrength={3.9}
          cDistance={3.6}
          cPolarAngle={90}
          lightType="3d"
          brightness={1.2}
          grain="off"
          reflection={0.1}
          zoomOut={false}
          positionX={-1.4}
          rotationY={10}
          rotationZ={50}
          positionY={0}
          positionZ={0}
          cAzimuthAngle={180}
          cameraZoom={1}
          frameRate={10}
          destination="onCanvas"
          embedMode="off"
          envPreset="city"
          range="disabled"
          rangeEnd={40}
          rangeStart={0}
          wireframe={false}
          enableTransition
        />
      </ShaderGradientCanvas>
    </div>
  );
}
