// Diamond Shader Demo, Roland Csibrei, 2021

import {
  Animation,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Scene,
  SceneLoader,
  Color4,
  DirectionalLight,
  NodeMaterial,
  InputBlock,
  MeshBuilder,
  Plane,
  StandardMaterial,
  MirrorTexture,
  ShadowGenerator,
  CubeTexture,
  TransformNode,
  DefaultRenderingPipeline,
  Color3,
  Mesh,
  MeshExploder,
  CubicEase,
  EasingFunction,
  IAnimationKey,
  VolumetricLightScatteringPostProcess,
  Texture,
  AbstractMesh,
  Layer
} from '@babylonjs/core'
import '@babylonjs/loaders'

import { moveCameraTo } from 'src/utils/camera'
import { BaseScene } from './BaseScene'

const BASE_URL = 'models/'
const CAMERA_Y = 0.8

export class DiamondSphere extends BaseScene {
  private _shadowGenerator?: ShadowGenerator

  private _meshes: Mesh[] = []
  private _sunRays: Mesh | null = null

  private _stopRotation = false
  private _decoy?: Mesh
  private _parent?: TransformNode
  private _explosion?: MeshExploder
  private _explosionInfo: {
    ratio: number
    animations: Animation[]
    update: boolean
  } = {
    ratio: 0,
    animations: [],
    update: false
  }

  constructor(canvas: HTMLCanvasElement) {
    super(canvas)
  }

  createCamera() {
    const camera = new ArcRotateCamera('camera1', 6.33, 1.13, 12.2687, new Vector3(0, 0, 0), this._scene)
    camera.attachControl(this._canvas, true)
    // camera.inertia = 0.8
    // camera.speed = 0.05
    // camera.minZ = 0.05
    // camera.maxZ = 50
    camera.lowerBetaLimit = 0
    camera.upperBetaLimit = 99999999999
    camera.lowerRadiusLimit = 8
    camera.upperRadiusLimit = 160
    // camera.angularSensibilityX = 2000
    // camera.angularSensibilityY = 2000
    // camera.panningSensibility = 3000
    // camera.pinchDeltaPercentage = 0.2
    // camera.wheelDeltaPercentage = 0.2
    // camera.speed = 0.05

    this._camera = camera

    // this.setCamera0()
  }

  private _animateExplosionRatioTo(ratio: number) {
    const ease = new CubicEase()
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT)

    const speed = 120
    const anim = new Animation('explosionRatioAnim,', 'ratio', speed, Animation.ANIMATIONTYPE_FLOAT)
    this._explosionInfo.update = true

    const keyFrames: IAnimationKey[] = []

    keyFrames.push({
      frame: 0,
      value: this._explosionInfo.ratio
    })

    keyFrames.push({
      frame: speed,
      value: ratio
    })

    anim.setKeys(keyFrames)

    this._explosionInfo.animations.push(anim)

    this._scene.beginAnimation(this._explosionInfo, 0, speed, false, 4, () => {
      this._explosionInfo.update = false
    })
  }

  private _createSunRays(mesh?: Mesh) {
    if (!this._camera) {
      return
    }

    const name = 'a-sun'
    mesh = mesh ?? Mesh.CreatePlane(name, 1.2, this._scene)
    const material = new StandardMaterial(`${name}Material`, this._scene)
    mesh.material = material
    material.diffuseColor = new Color3(0.0, 1.0, 0.0)
    material.emissiveColor = new Color3(1, 1, 1)
    // material.emissiveColor = new Color3(0.3, 0.1, 0.1);
    material.backFaceCulling = false
    mesh.position = new Vector3(0, 0, 0)
    mesh.scalingDeterminant *= 2
    mesh.visibility = 1
    mesh.billboardMode = AbstractMesh.BILLBOARDMODE_ALL
    mesh.scaling = new Vector3(2, 2, 2)

    material.diffuseTexture = new Texture('textures/rainbow.png', this._scene)
    material.diffuseTexture.hasAlpha = true

    const sunRays = new VolumetricLightScatteringPostProcess('sunRays', 1, this._camera, mesh, 100, Texture.BILINEAR_SAMPLINGMODE, this._engine, false)

    sunRays.exposure = 0.3
    sunRays.decay = 0.96815
    sunRays.weight = 0.98767
    sunRays.density = 0.996

    // sunRays.excludedMeshes = [sunMesh];
    this._sunRays = sunRays.mesh
  }

  public hideStructure() {
    this._animateExplosionRatioTo(0.05)
  }
  public showStructure() {
    this._animateExplosionRatioTo(0.24)
  }

  public startRotation() {
    this._stopRotation = false
  }
  public stopRotation() {
    this._stopRotation = true
  }

  private _updateDiamondColorInMaterial(material: NodeMaterial, color: Color3) {
    const baseColorBlock = <InputBlock>material.getBlockByName('baseColor')
    baseColorBlock.value = color
  }

  private _enableBloom(scene: Scene) {
    const pipeline = new DefaultRenderingPipeline('pipeline', true, scene, scene.cameras)
    pipeline.bloomEnabled = true
    pipeline.bloomThreshold = 0.2
    pipeline.bloomWeight = 0.01
    pipeline.bloomKernel = 4
    pipeline.bloomScale = 0.05
    pipeline.imageProcessingEnabled = false
    pipeline.fxaaEnabled = true
    pipeline.samples = 2
  }

  private async _createDiamondDemo(scene: Scene) {
    const layer = new Layer('', 'textures/stars-2.jpg', this._scene, true)

    const meshes = await this._loadDiamond()
    this._meshes = <Mesh[]>meshes
    this._explosion = new MeshExploder(this._meshes)
    this._explosion.explode(0.05)
    if (meshes) {
      // const snippetId = 'J3ZDKQ'
      const snippetId = 'KIUSWC#69'

      //

      const matBigDiamond = await NodeMaterial.ParseFromSnippetAsync(snippetId, scene)
      matBigDiamond.backFaceCulling = false
      matBigDiamond.separateCullingPass = true

      //

      const parent = new TransformNode('parent', scene)
      parent.position.y = 0
      this._parent = parent

      const decoy = new TransformNode('decoy', scene)
      decoy.parent = parent
      //

      const ground = MeshBuilder.CreateGround('ground', { width: 300, height: 300 }, scene)

      ground.setEnabled(false)
      this._createSunRays()

      ground.computeWorldMatrix(true)
      const groundWorldMatrix = ground.getWorldMatrix()

      const groundVertexData = ground.getVerticesData('normal')
      const mirrorMaterial = new StandardMaterial('mirror', scene)
      const reflectionTexture = new MirrorTexture('mirror', 2048, scene, true)
      const reflectionTextureRenderList = reflectionTexture.renderList ?? []
      if (groundVertexData) {
        const groundNormal = Vector3.TransformNormal(new Vector3(groundVertexData[0], groundVertexData[1], groundVertexData[2]), groundWorldMatrix)

        const reflector = Plane.FromPositionAndNormal(ground.position, groundNormal.scale(-1))
        mirrorMaterial.reflectionTexture = reflectionTexture
        reflectionTexture.mirrorPlane = reflector
        reflectionTexture.adaptiveBlurKernel = 16

        const shadowMap = this._shadowGenerator?.getShadowMap()
        meshes.forEach((m, idx) => {
          m.name = `S${idx}`
          // m.rotation = new Vector3(0, 0, 0)
          const matMesh = matBigDiamond.clone(`Sat-${idx}`)
          m.material = matMesh
          m.parent = parent
          reflectionTextureRenderList.push(m)

          const r = 0.5 // Math.random()
          const g = 0.5 // Math.random()
          const b = Math.random() * 0.1 + 0.5
          const color = new Color3(r, g, b)
          this._updateDiamondColorInMaterial(matMesh, color)
          if (shadowMap) {
            shadowMap.renderList?.push(m)
          }
        })

        mirrorMaterial.reflectionTexture.level = 1
        mirrorMaterial.disableLighting = true
        mirrorMaterial.alpha = 0.12
        ground.material = mirrorMaterial

        ground.receiveShadows = true
      }
    }

    this._scene.onBeforeRenderObservable.add(() => {
      if (this._parent && !this._stopRotation) {
        const arcCamera = <ArcRotateCamera>this._camera
        arcCamera.alpha += 0.008
        arcCamera.beta += 0.02
      }

      if (this._explosionInfo.update) {
        this._explosion?.explode(this._explosionInfo.ratio)
      }
    })
  }

  createLight(scene: Scene) {
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    light.intensity = 4

    const hdrTexture = CubeTexture.CreateFromPrefilteredData('env/decor-shop.env', scene)
    scene.environmentTexture = hdrTexture

    const dirLightParent = new TransformNode('dirLightParent', scene)

    const dirLight = new DirectionalLight('directionalLight', new Vector3(1, -1, -1), scene)
    dirLight.intensity = 2
    dirLight.position = new Vector3(-16, 16, 16)
    dirLight.parent = dirLightParent

    const shadowGenerator = new ShadowGenerator(2048, dirLight)
    shadowGenerator.usePoissonSampling = true
    shadowGenerator.useKernelBlur = true
    shadowGenerator.blurKernel = 64
    shadowGenerator.usePercentageCloserFiltering = true
    shadowGenerator.useContactHardeningShadow = true
    shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH
    shadowGenerator.contactHardeningLightSizeUVRatio = 0.3
    this._shadowGenerator = shadowGenerator

    dirLight.shadowMinZ = 0
    dirLight.shadowMinZ = 10

    scene.clearColor = new Color4(0, 0, 0, 1)

    this._scene.onBeforeRenderObservable.add(() => {
      dirLight.setDirectionToTarget(Vector3.ZeroReadOnly)
    })
  }

  public async initScene() {
    this._scene.clearColor = new Color4(0, 0, 0, 1)

    this.createCamera()
    this.createLight(this._scene)
    this._enableBloom(this._scene)

    await this._createDiamondDemo(this._scene)
  }

  public setCamera0() {
    const alpha = 6.33
    const beta = 1.13
    const radius = 12.2687
    const target = new Vector3(0, CAMERA_Y - 0.1, 0)
    this._animateCamera(alpha, beta, radius, target)
  }

  public setCamera1() {
    const alpha = -1.69
    const beta = 0.38
    const radius = 2.5
    const target = new Vector3(0, CAMERA_Y, 0.12)
    this._animateCamera(alpha, beta, radius, target)
  }

  public setCamera2() {
    const alpha = 0
    const beta = 0.08
    const radius = 3
    const target = new Vector3(0, CAMERA_Y, 0.12)
    this._animateCamera(alpha, beta, radius, target)
  }

  public setCamera3() {
    const alpha = -0.49
    const beta = 0.89
    const radius = 15
    const target = new Vector3(0, CAMERA_Y, 0)
    this._animateCamera(alpha, beta, radius, target)
  }

  private _animateCamera(alpha: number, beta: number, radius: number, target?: Vector3) {
    const arcCamera = <ArcRotateCamera>this._camera
    moveCameraTo(arcCamera, null, target, alpha, beta, radius)
  }

  private async _loadDiamond() {
    const loaded = await SceneLoader.ImportMeshAsync('', BASE_URL, 'cell-sphere-4.glb', this._scene)
    const meshes = loaded.meshes.filter(m => m.name.includes('_cell'))
    const main = loaded.meshes.find(m => m.name === 'Diamond Big 1')
    const root = loaded.meshes.find(m => m.name === '__root__')

    meshes.forEach(m => {
      m.setParent(null)
    })

    if (main) {
      main.setEnabled(false)
      main.setParent(null)
    }

    root?.dispose()
    return meshes
  }
}
