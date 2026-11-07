# PHOTON

**A code-only computational astrophysics observatory.**

PHOTON is an experimental real-time WebGL project exploring the visual appearance of black holes, gravitational lensing, and accretion disks.

## Run locally

No build step or package installation is required.

1. Clone the repository.
2. Serve the project directory with any local static HTTP server.
3. Open the local address in a WebGL 2-capable browser.

Opening `index.html` directly may work in some browsers, but a local server is recommended.

## Current prototype

- Full-screen WebGL 2 fragment-shader renderer
- Procedural starfield and accretion-disk texture
- Interactive horizontal orbit and zoom
- Pause/resume control
- Responsive observatory interface

**Scientific note:** the current image is an artistic rendering prototype. Its lensing treatment is a screen-space approximation, not yet a numerical integration of null geodesics in Schwarzschild spacetime. The project roadmap is to replace that approximation with a physically grounded ray tracer, then add relativistic disk emission and a rotating Kerr model.

## Roadmap

1. Establish a stable rendering and interaction foundation.
2. Implement Schwarzschild null-geodesic ray tracing.
3. Trace rays through a geometrically defined accretion disk.
4. Add gravitational redshift, Doppler beaming, and physically motivated emission.
5. Extend the model to Kerr spacetime.

## Technology

- WebGL 2
- GLSL ES 3.00
- Vanilla JavaScript
- HTML and CSS

No pre-rendered black-hole imagery or imported 3D models are used.
