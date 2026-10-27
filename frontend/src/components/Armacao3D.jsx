import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, PerspectiveCamera, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import './Armacao3D.css'

/**
 * Armação 3D do topo da home: modelo de acetato preto (public/modelos/armacao-oak.glb,
 * convertido do Glasses.fbx que o Gustavo mandou) com a marca "OAK" gravada
 * em branco na lateral das hastes.
 *
 * O .glb já vem pronto para cá: frente virada para +z, 4,8 unidades de
 * largura, cada haste num grupo com o eixo na dobradiça, e o ponto da
 * gravura (posição e normal na face de fora) gravado no userData da cena.
 *
 * Interação: segue o ponteiro de leve e gira quando a pessoa arrasta
 * (com inércia; ao soltar ela volta a ficar de frente).
 *
 * Carregada sob demanda pelo Hero: o three.js só baixa depois do resto da
 * página, e quem não tem WebGL continua vendo o SVG.
 */

const VOLTA = Math.PI * 2
// pose de descanso em três quartos: de frente a armação parecia um desenho chapado
const POSE = { x: 0.12, y: -0.58 }

const URL_MODELO = '/modelos/armacao-oak.glb'
// sem Draco nem Meshopt: o arquivo não usa compressão e assim nenhum decodificador é baixado de fora
useGLTF.preload(URL_MODELO, false, false)

// quanto cada haste gira para fechar (atrás da frente); a esquerda fecha um
// pouco menos para as duas não se atravessarem
const FECHADA = { Esq: -1.42, Dir: 1.52 }

const MARCA = 'OAK'
const FONTE_MARCA = '600 150px Inter, Helvetica, Arial, sans-serif'

// Gravura da marca: texto branco num canvas transparente, aplicado como uma
// película sobre a face de fora da haste. A fonte é a Inter que a página já
// carrega; se ela ainda não chegou, redesenha quando chegar.
function texturaMarca() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const g = canvas.getContext('2d')
  const textura = new THREE.CanvasTexture(canvas)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = 8

  const desenhar = () => {
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.font = FONTE_MARCA
    g.letterSpacing = '30px'
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // o espaçamento entra também depois da última letra: meio espaço de ajuste recentraliza
    g.fillText(MARCA, canvas.width / 2 + 15, canvas.height / 2 + 6)
    textura.needsUpdate = true
  }
  desenhar()
  document.fonts?.load(FONTE_MARCA).then(desenhar, () => {})
  return textura
}

// acetato preto polido: quase sem cor própria, o que aparece é o reflexo do estúdio
function Acetato() {
  return (
    <meshPhysicalMaterial
      color="#0b0b0c"
      roughness={0.16}
      clearcoat={1}
      clearcoatRoughness={0.03}
      envMapIntensity={1.6}
    />
  )
}

// valores tirados dos materiais V-Ray que vieram com o modelo (Chrome e Glass)
function Metal() {
  return <meshStandardMaterial color="#d9d9d9" metalness={1} roughness={0.08} />
}

function Vidro() {
  return (
    <meshPhysicalMaterial
      color="#ffffff"
      transparent
      opacity={0.1}
      roughness={0}
      ior={1.53}
      clearcoat={1}
      envMapIntensity={2.4}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  )
}

// a película da gravura encosta na face de fora da haste, virada pela normal dela
function poseGravura({ pos, normal }) {
  const ponto = new THREE.Vector3().fromArray(pos)
  const n = new THREE.Vector3().fromArray(normal)
  ponto.addScaledVector(n, 0.004)
  const alvo = new THREE.Object3D()
  alvo.position.copy(ponto)
  alvo.lookAt(ponto.clone().add(n))
  return { position: ponto.toArray(), quaternion: alvo.quaternion.toArray() }
}

const suavizar = (x) => x * x * (3 - 2 * x)

// Um quadro da animação. Fica fora do componente porque só mexe em refs e
// objetos do three.js, coisa que o React não acompanha.
function animarQuadro({ grupo, hasteEsq, hasteDir, inicio, seguir, giro, animar }, state, delta) {
  const t = state.clock.elapsedTime
  if (inicio.current === null) inicio.current = t
  // entrada: chega girando e crescendo; as hastes abrem no fim do giro
  const p = animar ? Math.min(1, (t - inicio.current) / 2.2) : 1
  const entrada = 1 - Math.pow(1 - p, 3)
  const abertura = suavizar(Math.min(1, Math.max(0, (p - 0.35) / 0.65)))

  // arraste: inércia enquanto gira solta, depois volta a ficar de frente
  const g = giro.current
  if (!g.arrastando) {
    g.y += g.vel * delta
    g.vel *= Math.pow(0.05, delta)
    if (Math.abs(g.vel) < 0.6) g.y = THREE.MathUtils.damp(g.y, Math.round(g.y / VOLTA) * VOLTA, 3, delta)
  }

  // segue o ponteiro de leve (o ponteiro vem da página toda, não só do canvas)
  const px = THREE.MathUtils.clamp(state.pointer.x, -1.5, 1.5)
  const py = THREE.MathUtils.clamp(state.pointer.y, -1.5, 1.5)
  const s = seguir.current
  s.y = THREE.MathUtils.damp(s.y, animar ? px * 0.38 : 0, 3.5, delta)
  s.x = THREE.MathUtils.damp(s.x, animar ? -py * 0.22 : 0, 3.5, delta)

  const balanco = animar ? Math.sin(t * 0.6) * 0.06 : 0
  grupo.current.rotation.set(
    POSE.x + s.x + balanco * 0.5,
    POSE.y + (1 - entrada) * -VOLTA * 1.25 + g.y + s.y + balanco,
    animar ? Math.sin(t * 0.45) * 0.025 : 0,
  )
  grupo.current.position.y = animar ? Math.sin(t * 0.9) * 0.08 : 0
  grupo.current.scale.setScalar(0.55 + 0.45 * entrada)

  // fechada: haste deitada atrás da frente; aberta: como veio no modelo
  hasteEsq.current.rotation.y = FECHADA.Esq * (1 - abertura)
  hasteDir.current.rotation.y = FECHADA.Dir * (1 - abertura)
}

function Oculos({ giro, animar, onPronto }) {
  const grupo = useRef()
  const hasteEsq = useRef()
  const hasteDir = useRef()
  const inicio = useRef(null)
  const seguir = useRef({ x: 0, y: 0 })

  const { nodes, scene } = useGLTF(URL_MODELO, false, false)
  const marca = useMemo(() => texturaMarca(), [])
  const gravuras = useMemo(
    () => ({ Esq: poseGravura(scene.userData.marca.hasteEsq), Dir: poseGravura(scene.userData.marca.hasteDir) }),
    [scene],
  )

  useEffect(() => () => marca.dispose(), [marca])
  // o modelo chegou: o Armacao3D tira a ilustração em SVG que estava no lugar
  useEffect(() => onPronto(), [onPronto])

  useFrame((state, delta) => animarQuadro({ grupo, hasteEsq, hasteDir, inicio, seguir, giro, animar }, state, delta))

  return (
    <group ref={grupo}>
      {/* centraliza o conjunto: as hastes puxam o volume para trás */}
      <group position={[0, 0, 0.4]}>
        <mesh geometry={nodes.Frente.geometry}>
          <Acetato />
        </mesh>
        {['Esq', 'Dir'].map((lado) => (
          <group key={lado}>
            <mesh geometry={nodes['Lente' + lado].geometry}>
              <Vidro />
            </mesh>
            <mesh geometry={nodes['Dobradica' + lado].geometry}>
              <Metal />
            </mesh>
            <group ref={lado === 'Esq' ? hasteEsq : hasteDir} position={nodes['Haste' + lado].position}>
              <mesh geometry={nodes['Haste' + lado + 'Malha'].geometry}>
                <Acetato />
              </mesh>
              <mesh {...gravuras[lado]}>
                <planeGeometry args={[0.76, 0.19]} />
                <meshStandardMaterial map={marca} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-2} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

// No tablet e no celular o quadro vira faixa (16:9) e a altura limita a
// armação: a câmera chega mais perto para ela não ficar miúda
function Enquadramento() {
  const largo = useThree((state) => state.size.width / state.size.height > 1.3)
  return <PerspectiveCamera makeDefault position={[0, 0.4, largo ? 9 : 12]} fov={32} />
}

function Armacao3D({ className = '' }) {
  const caixa = useRef(null)
  const giro = useRef({ y: 0, vel: 0, arrastando: false, ultimoX: 0, ultimoT: 0 })
  const [visivel, setVisivel] = useState(true)
  const [mexeu, setMexeu] = useState(false)
  const [pronto, setPronto] = useState(false)
  const marcarPronto = useMemo(() => () => setPronto(true), [])
  const [animar] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  // fora da tela não renderiza: poupa bateria e GPU de quem já rolou a página
  useEffect(() => {
    const observador = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting))
    observador.observe(caixa.current)
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    const mover = (e) => {
      const g = giro.current
      if (!g.arrastando) return
      const dx = e.clientX - g.ultimoX
      const dt = Math.max((e.timeStamp - g.ultimoT) / 1000, 0.008)
      g.y += dx * 0.012
      g.vel = (dx * 0.012) / dt
      g.ultimoX = e.clientX
      g.ultimoT = e.timeStamp
    }
    const soltar = () => {
      const g = giro.current
      if (!g.arrastando) return
      g.arrastando = false
      // parou antes de soltar: sem arremesso
      if (performance.now() - g.ultimoT > 80) g.vel = 0
      caixa.current?.classList.remove('armacao3d--arrastando')
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
  }, [])

  const pegar = (e) => {
    const g = giro.current
    g.arrastando = true
    g.vel = 0
    g.ultimoX = e.clientX
    g.ultimoT = e.timeStamp
    caixa.current.classList.add('armacao3d--arrastando')
    setMexeu(true)
  }

  return (
    <>
      <div ref={caixa} className={`armacao3d ${className}`} onPointerDown={pegar}>
        <Canvas
          dpr={[1, 2]}
          frameloop={visivel ? 'always' : 'never'}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          eventSource={document.getElementById('root')}
          eventPrefix="client"
          aria-hidden="true"
        >
          <ambientLight intensity={0.25} />
          <directionalLight position={[3, 4, 5]} intensity={1.6} color="#fff4e6" />
          <directionalLight position={[-4, 1, -3]} intensity={1.2} color="#d9b98f" />
          {/* contraluz: recorta o contorno do acetato preto contra o fundo escuro */}
          <directionalLight position={[0, 3, -6]} intensity={2.5} />

          {/* estúdio feito de painéis de luz: dá os reflexos do acetato e das lentes
            sem baixar nenhum HDR */}
          <Environment resolution={256} frames={1}>
            <Lightformer
              intensity={2.2}
              position={[0, 5, -2]}
              rotation-x={Math.PI / 2}
              scale={[10, 2, 1]}
              color="#fff3e0"
            />
            <Lightformer intensity={2.6} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 1.4, 1]} />
            <Lightformer
              intensity={1.6}
              position={[5, 0.5, 1]}
              rotation-y={-Math.PI / 2}
              scale={[8, 1, 1]}
              color="#d9b98f"
            />
            <Lightformer form="ring" intensity={2.4} position={[2, 2, 7]} scale={2.2} />
          </Environment>

          <Enquadramento />
          <Suspense fallback={null}>
            <Oculos giro={giro} animar={animar} onPronto={marcarPronto} />
          </Suspense>
        </Canvas>
        {/* a dica só entra junto com a armação, nunca sozinha enquanto o modelo baixa */}
        {pronto && (
          <span className={`armacao3d__dica${mexeu ? ' armacao3d__dica--some' : ''}`} aria-hidden="true">
            Arraste para girar
          </span>
        )}
      </div>
    </>
  )
}

export default Armacao3D
