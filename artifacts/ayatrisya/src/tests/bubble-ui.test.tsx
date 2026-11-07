import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SoapBubbleButton,
  SoapBubbleIconButton,
  SoapBubbleSearch,
  SoapBubbleToggle,
  SoapBubbleSlider,
  BubbleButton,
  BubbleIconButton,
} from '../components/bubble-ui';
import { Button } from '../components/ui/button';

describe('Bubble UI (Soap Film Interface Components)', () => {
  it('renders SoapBubbleButton correctly', () => {
    const html = renderToStaticMarkup(
      <SoapBubbleButton>Click me</SoapBubbleButton>
    );
    expect(html).toContain('soap-bubble-button');
    expect(html).toContain('Click me');
    expect(html).toContain('data-soap-bubble');
  });

  it('renders SoapBubbleIconButton correctly', () => {
    const html = renderToStaticMarkup(
      <SoapBubbleIconButton aria-label="Settings">
        <span>⚙</span>
      </SoapBubbleIconButton>
    );
    expect(html).toContain('soap-bubble-icon-button');
    expect(html).toContain('aria-label="Settings"');
  });

  it('renders BubbleButton and BubbleIconButton aliases', () => {
    const htmlBtn = renderToStaticMarkup(
      <BubbleButton>Bubble Action</BubbleButton>
    );
    expect(htmlBtn).toContain('soap-bubble-button');
    expect(htmlBtn).toContain('Bubble Action');

    const htmlIcon = renderToStaticMarkup(
      <BubbleIconButton aria-label="Search icon">
        <span>🔍</span>
      </BubbleIconButton>
    );
    expect(htmlIcon).toContain('soap-bubble-icon-button');
  });

  it('renders SoapBubbleToggle switch and SoapBubbleSearch field', () => {
    const toggleHtml = renderToStaticMarkup(<SoapBubbleToggle defaultChecked />);
    expect(toggleHtml).toContain('role="switch"');
    expect(toggleHtml).toContain('aria-checked="true"');

    const searchHtml = renderToStaticMarkup(<SoapBubbleSearch placeholder="Search prompts..." />);
    expect(searchHtml).toContain('soap-bubble-search');
    expect(searchHtml).toContain('placeholder="Search prompts..."');
  });

  it('renders UI Button with bubble variant', () => {
    const html = renderToStaticMarkup(
      <Button variant="bubble">Soap Film Button</Button>
    );
    expect(html).toContain('Soap Film Button');
  });
});
