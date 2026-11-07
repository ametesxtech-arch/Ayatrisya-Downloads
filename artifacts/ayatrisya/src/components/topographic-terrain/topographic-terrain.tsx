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
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  createTopographicRenderer,
  type TopographicConfig,
} from './topographic-renderer';
import { createTopographicTerrainSurface } from './topographic-terrain-renderer';
import {
  topographicTerrainDefaults,
  topographicTerrainPresets,
  type TopographicTerrainPreset,
  type TopographicTerrainGradientColors,
} from './topographic-terrain-presets';
import './topographic-terrain.css';

export type TopographicTerrainHandle = { reset: () => void };
export type TopographicTerrainProps = Partial<
  Omit<TopographicConfig, 'lineStyle' | 'dashLength' | 'dashGap'>
> & {
  /** Fade in the first complete frame. Disable for an immediate entrance. */
  animateEntrance?: boolean;
  preset?: TopographicTerrainPreset;
  backgroundImage?: CSSProperties['backgroundImage'];
  height?: number | string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export const TopographicTerrain = forwardRef<TopographicTerrainHandle, TopographicTerrainProps>(
  function TopographicTerrain(
    {
      animateEntrance = topographicTerrainDefaults.animateEntrance,
      preset = 'terraced',
      height,
      children,
      className = '',
      style,
      scale,
      density,
      speed,
      distortion,
      lineWidth,
      opacity,
      seed,
      paused,
      lineColor,
      accentColor,
      grain,
      gradientColors,
      gradientDiffusion,
      backgroundColor,
      backgroundImage,
      surfaceColor,
      shadowColor,
      shadowAnimation,
      shadowCycleDuration,
      elevation,
      cameraTilt,
      cameraRotation,
      cameraZoom,
      terraceSoftness,
      lightingBlend,
      lightDirection,
      lightIntensity,
      hover,
      hoverRadius,
      hoverFollow,
      hoverFade,
    },
    ref,
  ) {
    const host = useRef<HTMLDivElement>(null),
      canvas = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);
    const renderer = useRef<ReturnType<typeof createTopographicRenderer> | null>(null);
    const palette = topographicTerrainPresets[preset] ?? topographicTerrainPresets.terraced;
    const followsTheme = preset === 'terraced' || preset === 'terraced-top';
    const config = useMemo<TopographicConfig>(
      () => ({
        scale: scale ?? palette.scale,
        density: density ?? palette.density,
        speed: speed ?? palette.speed,
        distortion: distortion ?? palette.distortion,
        lineWidth: lineWidth ?? palette.lineWidth,
        opacity: opacity ?? palette.opacity,
        seed: seed ?? palette.seed,
        paused: paused ?? palette.paused,
        lineColor:
          lineColor ?? (followsTheme ? 'var(--topographic-terrain-ink)' : palette.lineColor),
        accentColor:
          accentColor ?? (followsTheme ? 'var(--topographic-terrain-ink)' : palette.accentColor),
        lineStyle: 'solid',
        dashLength: 7,
        dashGap: 8,
        grain: grain ?? palette.grain,
        gradientColors: gradientColors ?? palette.gradientColors,
        gradientDiffusion: gradientDiffusion ?? palette.gradientDiffusion,
        surfaceColor:
          surfaceColor ??
          (followsTheme ? 'var(--topographic-terrain-material)' : palette.surfaceColor),
        backgroundColor:
          style?.backgroundColor ??
          backgroundColor ??
          (followsTheme ? 'var(--topographic-terrain-material)' : palette.backgroundColor),
        shadowColor:
          shadowColor ??
          (surfaceColor === undefined && !(gradientColors ?? palette.gradientColors).length
            ? followsTheme
              ? 'var(--topographic-terrain-shadow)'
              : palette.shadowColor
            : undefined),
        shadowAnimation: shadowAnimation ?? palette.shadowAnimation,
        shadowCycleDuration: shadowCycleDuration ?? palette.shadowCycleDuration,
        elevation: elevation ?? palette.elevation,
        cameraTilt: cameraTilt ?? palette.cameraTilt,
        cameraRotation: cameraRotation ?? palette.cameraRotation,
        cameraZoom: cameraZoom ?? palette.cameraZoom,
        terraceSoftness: terraceSoftness ?? palette.terraceSoftness,
        lightingBlend: lightingBlend ?? palette.lightingBlend,
        lightDirection: lightDirection ?? palette.lightDirection,
        lightIntensity: lightIntensity ?? palette.lightIntensity,
        hover: hover ?? palette.hover,
        hoverRadius: hoverRadius ?? palette.hoverRadius,
        hoverFollow: hoverFollow ?? palette.hoverFollow,
        hoverFade: hoverFade ?? palette.hoverFade,
      }),
      [
        palette,
        preset,
        followsTheme,
        scale,
        density,
        speed,
        distortion,
        lineWidth,
        opacity,
        seed,
        paused,
        lineColor,
        accentColor,
        grain,
        gradientColors,
        gradientDiffusion,
        surfaceColor,
        shadowColor,
        shadowAnimation,
        shadowCycleDuration,
        style?.backgroundColor,
        backgroundColor,
        elevation,
        cameraTilt,
        cameraRotation,
        cameraZoom,
        terraceSoftness,
        lightingBlend,
        lightDirection,
        lightIntensity,
        hover,
        hoverRadius,
        hoverFollow,
        hoverFade,
      ],
    );
    const latest = useRef(config);
    latest.current = config;
    useImperativeHandle(ref, () => ({ reset: () => renderer.current?.reset() }), []);
    useEffect(() => {
      if (!canvas.current || !host.current) return;
      const instance = createTopographicRenderer(
        canvas.current,
        host.current,
        latest.current,
        createTopographicTerrainSurface,
        () => setReady(true),
      );
      renderer.current = instance;
      return () => {
        instance.destroy();
        renderer.current = null;
      };
    }, []);
    useEffect(() => renderer.current?.update(config), [config]);
    useEffect(() => {
      const syncTheme = () => renderer.current?.update(latest.current);
      const observer = new MutationObserver(syncTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class'],
      });
      const media = matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', syncTheme);
      return () => {
        observer.disconnect();
        media.removeEventListener('change', syncTheme);
      };
    }, []);
    return (
      <div
        ref={host}
        data-ready={ready}
        data-animate-entrance={animateEntrance}
        className={`topographic-terrain ${className}`}
        style={{
          height,
          backgroundColor:
            backgroundColor ??
            (followsTheme ? 'var(--topographic-terrain-material)' : palette.backgroundColor),
          backgroundImage: backgroundImage ?? palette.backgroundImage,
          ...style,
        }}
      >
        <canvas ref={canvas} className="topographic-terrain-canvas" aria-hidden="true" />
        {children && <div className="topographic-terrain-content">{children}</div>}
      </div>
    );
  },
);
export { topographicTerrainDefaults, topographicTerrainPresets };
export type { TopographicTerrainPreset, TopographicTerrainGradientColors };
