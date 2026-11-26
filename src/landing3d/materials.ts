import { Color, MeshPhysicalMaterial } from 'three'

export const goldMaterial = new MeshPhysicalMaterial({ color: '#f2c14e', metalness: 1, roughness: 0.22 })
export const fabric = (color: string) => new MeshPhysicalMaterial({ color: new Color(color), roughness: 0.85, sheen: 0.6, sheenColor: new Color('#ffffff'), sheenRoughness: 0.8 })
