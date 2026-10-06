import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';

const BoxModel = () => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [doorProgress, setDoorProgress] = useState(0);
  const doorAnimRef = useRef<{
    target: number;
    current: number;
  }>({
    target: 0,
    current: 0
  });
  const W = 4;
  const H = 3.4;
  const D = 3.5;
  const DH = 2.25;
  const DW = 3.4;
  const NUM_SLATS = 14;
  const slatHeight = DH / NUM_SLATS;
  const boxBottom = -H / 2;
  useFrame((_, delta) => {
    if (groupRef.current && !hovered) {
      groupRef.current.rotation.y += 0.003;
    }
    const anim = doorAnimRef.current;
    const diff = anim.target - anim.current;
    if (Math.abs(diff) > 0.001) {
      anim.current += diff * Math.min(delta * 3, 1);
      setDoorProgress(anim.current);
    }
  });
  const handleDoorClick = (event: {
    stopPropagation: () => void;
  }) => {
    event.stopPropagation();
    const newOpen = !doorOpen;
    setDoorOpen(newOpen);
    doorAnimRef.current.target = newOpen ? 1 : 0;
  };
  const slats = useMemo(() => {
    const items: {
      index: number;
      baseY: number;
    }[] = [];
    for (let i = 0; i < NUM_SLATS; i++) {
      const baseY = -H / 2 + (i + 0.5) * slatHeight;
      items.push({
        index: i,
        baseY
      });
    }
    return items;
  }, [H, NUM_SLATS, slatHeight]);
  return <group ref={groupRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)} position={[0, 0.5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -H / 2 + 0.01, 0]}>
        <planeGeometry args={[6, 5.5]} />
        <meshBasicMaterial color="#F97316" opacity={0.85} transparent />
      </mesh>
      <mesh>
        <boxGeometry args={[W, H, D]} />
        <meshBasicMaterial color="white" opacity={0.07} transparent side={THREE.DoubleSide} depthWrite={false} />
        <Edges scale={1} threshold={15} color="white" />
      </mesh>
      <mesh position={[-1.85, boxBottom + DH / 2, D / 2 + 0.001]}>
        <planeGeometry args={[0.3, DH]} />
        <meshBasicMaterial color="white" opacity={0.1} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[1.85, boxBottom + DH / 2, D / 2 + 0.001]}>
        <planeGeometry args={[0.3, DH]} />
        <meshBasicMaterial color="white" opacity={0.1} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, boxBottom + DH + (H - DH) / 2, D / 2 + 0.001]}>
        <planeGeometry args={[W, H - DH]} />
        <meshBasicMaterial color="white" opacity={0.1} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, boxBottom + DH / 2, D / 2 + 0.001]}>
        <planeGeometry args={[DW, DH]} />
        <meshBasicMaterial color="white" opacity={0.13} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[-DW / 2, boxBottom + DH / 2, D / 2 + 0.003]}>
        <planeGeometry args={[0.012, DH]} />
        <meshBasicMaterial color="white" opacity={0.9} transparent />
      </mesh>
      <mesh position={[DW / 2, boxBottom + DH / 2, D / 2 + 0.003]}>
        <planeGeometry args={[0.012, DH]} />
        <meshBasicMaterial color="white" opacity={0.9} transparent />
      </mesh>
      <group onClick={handleDoorClick} onPointerOver={event => {
      event.stopPropagation();
      document.body.style.cursor = 'pointer';
    }} onPointerOut={event => {
      event.stopPropagation();
      document.body.style.cursor = 'auto';
    }}>
        {slats.map(({
        index,
        baseY
      }) => {
        const slatProgress = Math.max(0, Math.min(1, doorProgress * NUM_SLATS - index));
        const yOffset = slatProgress * DH;
        const currentY = baseY + yOffset;
        const visible = currentY < -H / 2 + DH + slatHeight;
        if (!visible) {
          return null;
        }
        return <group key={`slat-${index}`} position={[0, currentY, D / 2 + 0.002]}>
              <mesh>
                <planeGeometry args={[DW, slatHeight * 0.88]} />
                <meshBasicMaterial color="white" opacity={0.5} transparent side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
              <mesh position={[0, slatHeight * 0.44, 0.001]}>
                <planeGeometry args={[DW, 0.012]} />
                <meshBasicMaterial color="white" opacity={0.9} transparent />
              </mesh>
              <mesh position={[0, -slatHeight * 0.44, 0.001]}>
                <planeGeometry args={[DW, 0.008]} />
                <meshBasicMaterial color="white" opacity={0.5} transparent />
              </mesh>
            </group>;
      })}
        <mesh position={[0, -H / 2 + 0.01, D / 2 + 0.003]}>
          <planeGeometry args={[DW, 0.025]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh position={[0, -H / 2 + DH, D / 2 + 0.003]}>
          <planeGeometry args={[DW, 0.025]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh position={[-DW / 2, -H / 2 + DH / 2, D / 2 + 0.003]}>
          <planeGeometry args={[0.025, DH]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh position={[DW / 2, -H / 2 + DH / 2, D / 2 + 0.003]}>
          <planeGeometry args={[0.025, DH]} />
          <meshBasicMaterial color="white" />
        </mesh>
      </group>
      <Html position={[0, -H / 2 + DH / 2, D / 2 + 0.2]} center>
        <div style={{
        opacity: doorProgress < 0.1 ? 1 : 0,
        transition: 'opacity 0.4s',
        pointerEvents: 'none',
        background: 'rgba(249,115,22,0.85)',
        color: 'white',
        fontSize: '11px',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '20px',
        whiteSpace: 'nowrap',
        letterSpacing: '0.05em'
      }}>▶ Klik om te openen</div>
      </Html>
      <Html position={[0, H / 2 + 0.2, 0]} center>
        <div className="text-blue-400 font-mono text-sm whitespace-nowrap bg-gray-900/80 px-2 py-0.5 rounded border border-blue-500/30">4m</div>
      </Html>
      <Html position={[W / 2 + 0.3, 0, 0]} center>
        <div className="text-blue-400 font-mono text-sm whitespace-nowrap bg-gray-900/80 px-2 py-0.5 rounded border border-blue-500/30">3.4m</div>
      </Html>
      <Html position={[W / 2 + 0.2, -H / 2, D / 2]} center>
        <div className="text-blue-400 font-mono text-sm whitespace-nowrap bg-gray-900/80 px-2 py-0.5 rounded border border-blue-500/30">3.5m</div>
      </Html>
      <Html position={[-W / 2 - 0.2, -H / 2 + DH / 2, D / 2]} center>
        <div className="text-blue-400 font-mono text-sm whitespace-nowrap bg-gray-900/80 px-2 py-0.5 rounded border border-blue-500/30">2.25m</div>
      </Html>
    </group>;
};

const BoxViewer3D = () => <Canvas style={{
  background: '#0F1117'
}}>
    <OrthographicCamera makeDefault position={[5, 4, 5]} zoom={70} />
    <ambientLight intensity={0.5} />
    <directionalLight position={[10, 10, 5]} intensity={1} />
    <BoxModel />
    <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.2} />
  </Canvas>;
export default BoxViewer3D;
