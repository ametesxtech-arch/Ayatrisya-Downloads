/*!
ReactDrops Component License 1.0

Copyright (c) 2026 ReactDrops

1. Scope and definitions

This license applies to ReactDrops software and associated documentation that
expressly carry this license or are distributed under a LICENSE file containing
it (the "Software"). "Licensor" means the copyright holder granting rights in
the Software, and only to the extent that holder has authority to grant them.
"You" means the individual or entity exercising these rights.

An "End Product" is a website, application, service, or other finished project
whose primary purpose is something other than providing reusable components,
source code, templates, or development assets to others.

2. Permitted uses

Subject to this license, Licensor grants You a worldwide, non-exclusive,
royalty-free license to use, copy, modify, and incorporate the Software into
unlimited personal, internal, and commercial End Products. You may charge for
End Products, subscriptions, development services, and work for clients.

You may distribute the Software as an integrated part of an End Product,
including in browser-delivered JavaScript. You may provide End Product source
code to a client, and share the Software with employees and contractors who
need it to develop or maintain End Products. Those recipients may use the
Software for those purposes subject to this license. This permission does not
authorize them to redistribute the Software as a reusable development asset.

3. Restricted redistribution

Unless You obtain separate written permission from Licensor, You may not sell,
sublicense, publish, share, or otherwise redistribute the Software, or a
substantial portion of it, whether unchanged or modified:

(a) as a standalone component, component library, UI kit, source-code bundle,
    registry, or other collection of reusable development assets;
(b) as part of a theme, template, starter project, or similar product offered
    to multiple recipients for reuse in their own projects; or
(c) through a builder or generation service that offers the Software as
    reusable blocks or source-code exports for others' projects.

These restrictions apply to paid and free redistribution. Renaming, restyling,
repackaging, translating, or modifying the Software does not remove them.
Building separate finished websites or applications for multiple clients is
permitted; offering a reusable template or kit containing the Software is not.

Public source-code hosting by Licensor is not permission to republish the
Software under another license. This license does not override any separate
rights granted directly by Licensor or applicable code-hosting terms.

4. Notices and ownership

Retain this license and applicable copyright and third-party notices in source
copies of the Software and permitted source distributions. No visible credit
or ReactDrops logo is required in an End Product's user interface.

Licensor retains ownership of its Software. You retain rights in Your own
contributions, subject to the license for any incorporated Software. No rights
to trademarks, trade names, or logos are granted by this license.

5. Third-party materials and separate grants

Dependencies, fonts, images, videos, and other third-party materials remain
subject to their respective licenses. Separately identified third-party code
is licensed under its stated terms, and these restrictions do not limit rights
granted by its copyright holders. Retain all required third-party notices.
Demo media are not licensed by this document; obtain Your own permission or
replace them with media You are entitled to use.

This license does not revoke rights granted under other valid licenses. It does
not assert ownership of third-party work or grant rights Licensor lacks.

6. Termination

The permissions granted here continue unless terminated for a material breach.
If You fail to cure a material breach within 30 days after receiving written
notice from Licensor, Your permissions terminate. On termination, cease uses
and distributions requiring this license. Rights under independently granted
licenses and rights that applicable law does not allow to be restricted remain
unaffected. Sections 3 through 7 survive termination.

7. Disclaimer

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. TO THE MAXIMUM EXTENT
PERMITTED BY APPLICABLE LAW, LICENSOR AND CONTRIBUTORS SHALL NOT BE LIABLE FOR
ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT, OR OTHERWISE,
ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR ITS USE.

This license does not limit rights or exceptions that applicable law makes
non-waivable. No other permissions are granted by implication.
*/

'use client';

import React, {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';
import {
  fractalGlassDefaults,
  fractalGlassCoverage,
  normalizeFractalGlass,
  type FractalGlassSettings,
} from './fractal-glass-model';
import { createFractalGlassRenderer } from './fractal-glass-renderer';
import './fractal-glass.css';

export { fractalGlassPresets } from './fractal-glass-model';

export type FractalGlassProps = HTMLAttributes<HTMLDivElement> &
  Partial<FractalGlassSettings> & {
    /** Image to refract. Remote images must allow anonymous CORS for WebGL. */
    src: string;
    alt: string;
    height?: CSSProperties['height'];
    borderRadius?: CSSProperties['borderRadius'];
  };

export type FractalGlassHandle = {
  /** Export the current glass image, including its crop and rounded corners, as PNG. */
  exportImage: () => Promise<Blob>;
};

export const FractalGlass = forwardRef<FractalGlassHandle, FractalGlassProps>(function FractalGlass(
  {
    src,
    alt,
    children,
    height,
    borderRadius = 0,
    className = '',
    style,
    animateEntrance = fractalGlassDefaults.animateEntrance,
    mode = fractalGlassDefaults.mode,
    smoothness = fractalGlassDefaults.smoothness,
    textureScale = fractalGlassDefaults.textureScale,
    blackPoint = fractalGlassDefaults.blackPoint,
    whitePoint = fractalGlassDefaults.whitePoint,
    gamma = fractalGlassDefaults.gamma,
    edgeWidth = fractalGlassDefaults.edgeWidth,
    stripes = fractalGlassDefaults.stripes,
    distortion = fractalGlassDefaults.distortion,
    refractionBias = fractalGlassDefaults.refractionBias,
    blur = fractalGlassDefaults.blur,
    grain = fractalGlassDefaults.grain,
    relief = fractalGlassDefaults.relief,
    refraction = fractalGlassDefaults.refraction,
    roughness = fractalGlassDefaults.roughness,
    reflection = fractalGlassDefaults.reflection,
    dispersion = fractalGlassDefaults.dispersion,
    caustics = fractalGlassDefaults.caustics,
    coverage = fractalGlassDefaults.coverage,
    coverageMode = fractalGlassDefaults.coverageMode,
    side = fractalGlassDefaults.side,
    direction = fractalGlassDefaults.direction,
    hoverEffect = fractalGlassDefaults.hoverEffect,
    hoverPreset = fractalGlassDefaults.hoverPreset,
    recoveryDirection = fractalGlassDefaults.recoveryDirection,
    hoverAnimation = fractalGlassDefaults.hoverAnimation,
    hoverDuration = fractalGlassDefaults.hoverDuration,
    hoverRadius = fractalGlassDefaults.hoverRadius,
    hoverFeather = fractalGlassDefaults.hoverFeather,
    transitionBlend = fractalGlassDefaults.transitionBlend,
    duration = fractalGlassDefaults.duration,
    ease = fractalGlassDefaults.ease,
    disabled = false,
    maxDpr = fractalGlassDefaults.maxDpr,
    maxPixels = fractalGlassDefaults.maxPixels,
    tabIndex,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ReturnType<typeof createFractalGlassRenderer>>(null);
  useImperativeHandle(
    ref,
    () => ({
      async exportImage() {
        const snapshot = engine.current?.captureFrame();
        const element = host.current;
        if (!snapshot || !element)
          throw new Error(
            'The glass image is not ready. Use an uploaded image or a URL that allows CORS.',
          );
        const output = document.createElement('canvas');
        output.width = snapshot.width;
        output.height = snapshot.height;
        const context = output.getContext('2d');
        if (!context) throw new Error('Image export is unavailable in this browser.');
        const style = getComputedStyle(element);
        const radius = (value: string) => {
          const [x, y = x] = value.split(' ');
          const resolve = (part: string, size: number, cssSize: number) =>
            (parseFloat(part) || 0) *
            (part.endsWith('%') ? size / 100 : size / Math.max(1, cssSize));
          return {
            x: resolve(x, output.width, element.clientWidth),
            y: resolve(y, output.height, element.clientHeight),
          };
        };
        context.beginPath();
        context.roundRect(
          0,
          0,
          output.width,
          output.height,
          [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius,
          ].map(radius),
        );
        context.clip();
        context.drawImage(snapshot, 0, 0);
        return new Promise<Blob>((resolve, reject) => {
          output.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the PNG image.'))),
            'image/png',
          );
        });
      },
    }),
    [],
  );
  const [ready, setReady] = useState(false);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [touched, setTouched] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const pointerType = useRef('');
  const settings = normalizeFractalGlass({
    animateEntrance,
    mode,
    smoothness,
    textureScale,
    blackPoint,
    whitePoint,
    gamma,
    edgeWidth,
    stripes,
    distortion,
    refractionBias,
    blur,
    grain,
    relief,
    refraction,
    roughness,
    reflection,
    dispersion,
    caustics,
    coverage,
    coverageMode,
    side,
    direction,
    hoverEffect,
    hoverPreset,
    recoveryDirection,
    hoverAnimation,
    hoverDuration,
    hoverRadius,
    hoverFeather,
    transitionBlend,
    duration,
    ease,
    disabled,
    maxDpr,
    maxPixels,
  });
  const active = hovered || focused || touched;
  const latest = useRef({ settings, active });
  latest.current = { settings, active };
  const insideGlass = (x: number, y: number, bounds = host.current?.getBoundingClientRect()) => {
    const current = latest.current.settings;
    const covered = fractalGlassCoverage(current);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0 || current.disabled) return false;
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return false;
    if (current.hoverEffect && current.hoverAnimation === 'circle') return true;
    if (covered <= 0) return false;
    const horizontal = current.coverageMode === 'stripes' && current.direction === 'horizontal';
    const position = horizontal
      ? current.side === 'right'
        ? bounds.bottom - y
        : y - bounds.top
      : current.side === 'right'
        ? bounds.right - x
        : x - bounds.left;
    return position <= (horizontal ? bounds.height : bounds.width) * covered;
  };
  const moveCircle = (x: number, y: number, bounds = host.current?.getBoundingClientRect()) => {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    engine.current?.setPointer(
      (x - bounds.left) / bounds.width,
      1 - (y - bounds.top) / bounds.height,
    );
  };
  const trackPointer = (x: number, y: number) => {
    pointer.current = { x, y };
    const bounds = host.current?.getBoundingClientRect();
    moveCircle(x, y, bounds);
    const next = insideGlass(x, y, bounds);
    setHovered(next);
  };
  useLayoutEffect(() => {
    if (pointer.current) {
      const { x, y } = pointer.current;
      const bounds = host.current?.getBoundingClientRect();
      setHovered(insideGlass(x, y, bounds));
    }
  }, [
    coverage,
    coverageMode,
    stripes,
    textureScale,
    mode,
    direction,
    side,
    disabled,
    hoverEffect,
    hoverAnimation,
    height,
    style?.width,
    style?.height,
  ]);
  useEffect(() => {
    if (!canvas.current || !host.current) return;
    let mounted = true;
    const renderer = createFractalGlassRenderer(
      canvas.current,
      host.current,
      latest.current.settings,
      latest.current.active,
      (value) => {
        if (mounted) setReady(value);
      },
    );
    engine.current = renderer;
    return () => {
      mounted = false;
      renderer?.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.setSource(src);
  }, [src]);
  useLayoutEffect(() => {
    engine.current?.update(latest.current.settings, latest.current.active);
  }, [
    mode,
    smoothness,
    textureScale,
    blackPoint,
    whitePoint,
    gamma,
    edgeWidth,
    stripes,
    distortion,
    refractionBias,
    blur,
    grain,
    relief,
    refraction,
    roughness,
    reflection,
    dispersion,
    caustics,
    coverage,
    coverageMode,
    side,
    direction,
    hoverEffect,
    hoverPreset,
    recoveryDirection,
    hoverAnimation,
    hoverDuration,
    hoverRadius,
    hoverFeather,
    transitionBlend,
    duration,
    ease,
    disabled,
    maxDpr,
    maxPixels,
    active,
  ]);
  return (
    <div
      {...props}
      ref={host}
      className={`fractal-glass ${className}`.trim()}
      style={{
        height,
        borderRadius,
        aspectRatio: (style?.height ?? height) === undefined ? undefined : 'auto',
        ...style,
      }}
      data-renderer={ready ? 'webgl' : 'native'}
      data-animate-entrance={animateEntrance}
      data-image-ready={loadedSource === src}
      data-glass-mode={disabled ? 'disabled' : hoverEffect ? 'hover' : 'always'}
      data-hover-preset={hoverPreset}
      data-hover-animation={hoverAnimation}
      tabIndex={tabIndex ?? (hoverEffect && !disabled ? 0 : undefined)}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') trackPointer(event.clientX, event.clientY);
        onPointerEnter?.(event);
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== 'touch') trackPointer(event.clientX, event.clientY);
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        setHovered(false);
        pointer.current = null;
        touch.current = null;
        onPointerLeave?.(event);
      }}
      onPointerDown={(event) => {
        pointerType.current = event.pointerType;
        if (event.pointerType === 'touch' && insideGlass(event.clientX, event.clientY)) {
          touch.current = { x: event.clientX, y: event.clientY };
          moveCircle(event.clientX, event.clientY);
        }
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        const start = touch.current;
        touch.current = null;
        if (
          hoverEffect &&
          !disabled &&
          event.pointerType === 'touch' &&
          start &&
          insideGlass(event.clientX, event.clientY) &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8
        )
          setTouched((value) => !value);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        touch.current = null;
        pointer.current = null;
        setHovered(false);
        onPointerCancel?.(event);
      }}
      onFocus={(event) => {
        if (pointerType.current !== 'touch' && event.target.matches(':focus-visible')) {
          engine.current?.setPointer(0.5, 0.5);
          setFocused(true);
        }
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          pointerType.current = '';
        }
        onBlur?.(event);
      }}
    >
      <img
        className="fractal-glass-image"
        src={src || undefined}
        alt={alt}
        decoding="async"
        onLoad={(event) => {
          const image = event.currentTarget;
          void image
            .decode()
            .catch(() => {})
            .then(() => {
              if (image.isConnected && image.getAttribute('src') === src) setLoadedSource(src);
            });
        }}
      />
      <canvas ref={canvas} className="fractal-glass-canvas" aria-hidden="true" />
      {children !== undefined && <div className="fractal-glass-content">{children}</div>}
    </div>
  );
});
