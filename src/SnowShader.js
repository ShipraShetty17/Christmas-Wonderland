import { Color } from 'three';

export const SnowShader = {
  uniforms: {
    color: { value: new Color("#4CBB17") }, // Snow color
    lightPosition: { value: new Color("#F5F5F5") }, // Light Gray
  },
  vertexShader: /* glsl */ `
    precision highp float;
    precision highp int;

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normal;
      vPosition = position;

      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    precision highp int;

    uniform vec3 color;

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      float brightness = dot(normalize(vNormal), vec3(0.0, 1.0, 0.0));
      vec3 finalColor = color * (0.9 + 0.1 * brightness); // Make it slightly glossy and crispier

      gl_FragColor = vec4(finalColor, 1.0);
    }`,
};