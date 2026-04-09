import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentRenderer from '../../components/guide/ContentRenderer';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>diagram</svg>' }),
  },
}));

function renderContent(content: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <ContentRenderer content={content} />
    </MemoryRouter>
  );
}

describe('ContentRenderer', () => {
  it('should render headings with anchor IDs', () => {
    renderContent('## Battle Flow\n\n### Damage Calculation');

    const h2 = screen.getByRole('heading', { level: 2, name: 'Battle Flow' });
    expect(h2).toHaveAttribute('id', 'battle-flow');

    const h3 = screen.getByRole('heading', { level: 3, name: 'Damage Calculation' });
    expect(h3).toHaveAttribute('id', 'damage-calculation');
  });

  it('should render images with lazy loading', () => {
    renderContent('![Robot diagram](/images/guide/robot.png)');

    const img = screen.getByAltText('Robot diagram');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('src', '/images/guide/robot.png');
  });

  it('should show alt text fallback when image fails to load', () => {
    renderContent('![Broken image alt text](/images/guide/missing.png)');

    const img = screen.getByAltText('Broken image alt text');
    fireEvent.error(img);

    expect(screen.getByText('Broken image alt text')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should show default fallback text when image has no alt text and fails', () => {
    const { container } = renderContent('![](/images/guide/missing.png)');

    const img = container.querySelector('img')!;
    fireEvent.error(img);

    expect(screen.getByText('Image could not be loaded')).toBeInTheDocument();
  });

  it('should render internal guide links as React Router Links', () => {
    renderContent('[Battle Flow](/guide/combat/battle-flow)');

    const link = screen.getByRole('link', { name: 'Battle Flow' });
    expect(link).toHaveAttribute('href', '/guide/combat/battle-flow');
    // Internal links should NOT have target="_blank"
    expect(link).not.toHaveAttribute('target');
  });

  it('should render external links with target="_blank"', () => {
    renderContent('[External Site](https://example.com)');

    const link = screen.getByRole('link', { name: 'External Site' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should wrap tables in a scrollable container', () => {
    renderContent('| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |');

    const table = screen.getByRole('table');
    const wrapper = table.parentElement;
    expect(wrapper?.className).toContain('overflow-x-auto');
  });

  it('should render paragraphs', () => {
    renderContent('This is a paragraph of text.');

    expect(screen.getByText('This is a paragraph of text.')).toBeInTheDocument();
  });

  it('should render lists', () => {
    renderContent('- Item one\n- Item two\n- Item three');

    expect(screen.getByText('Item one')).toBeInTheDocument();
    expect(screen.getByText('Item two')).toBeInTheDocument();
    expect(screen.getByText('Item three')).toBeInTheDocument();
  });
});
