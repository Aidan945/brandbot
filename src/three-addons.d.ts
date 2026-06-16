// The runtime uses the `three/addons/*` alias (matching the import map / three's
// package exports); @types/three ships these under `three/examples/jsm/*`.
// Re-export the types so both resolve.
declare module 'three/addons/loaders/GLTFLoader.js' {
  export * from 'three/examples/jsm/loaders/GLTFLoader.js';
}
declare module 'three/addons/geometries/DecalGeometry.js' {
  export * from 'three/examples/jsm/geometries/DecalGeometry.js';
}
declare module 'three/addons/controls/OrbitControls.js' {
  export * from 'three/examples/jsm/controls/OrbitControls.js';
}
