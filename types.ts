import React from 'react';

export type Unit = 'in' | 'mm';

export interface TextureTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  textureWidth: number; // Physical width of the texture image in inches
  textureHeight: number; // Physical height of the texture image in inches
}

export interface TextureAdjustments {
  exposure: number;
  red: number;
  green: number;
  blue: number;
}

export interface UVMeshData {
  uvs: Float32Array;
  index: Uint16Array | Uint32Array | null;
  count: number;
}

export interface AppState {
  modelUrl: string | null;
  modelType: 'fbx' | 'obj' | null;
  textureUrl: string | null;
  transform: TextureTransform;
  useTriplanar: boolean;
  useSubmeshScale: boolean;
  uvStandardSize: number;
}

export interface ModelProps {
  modelUrl: string | null;
  modelType: 'fbx' | 'obj' | null;
  textureUrl: string | null;
  transform: TextureTransform; // Global/Default transform
  submeshTransforms: Record<string, TextureTransform>; // Per-mesh transforms
  selectedMeshId: string | null;
  onMeshSelect: (id: string | null, name: string | null) => void;
  onAnchorCalculated?: (height: number) => void;
  showDimensions?: boolean;
  showWireframe?: boolean;
  showUVGrid?: boolean;
  unit: Unit;
  onUVsLoaded?: (data: UVMeshData[]) => void;
  useTriplanar: boolean;
  useSubmeshScale: boolean;
  uvStandardSize: number;
}

// Augment the JSX namespace to include Three.js elements used in R3F
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      primitive: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      directionalLight: any;
    }
  }
}
