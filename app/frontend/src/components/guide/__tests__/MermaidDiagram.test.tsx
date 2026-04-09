import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MermaidDiagram from '../MermaidDiagram';

// Mock mermaid library
const mockRender = vi.fn();
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => mockRender(...args),
  },
}));

describe('MermaidDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render SVG output on successful mermaid render', async () => {
    const svgOutput = '<svg><text>Test Diagram</text></svg>';
    mockRender.mockResolvedValue({ svg: svgOutput });

    const { container } = render(<MermaidDiagram chart="graph TD; A-->B" />);

    await waitFor(() => {
      const svgContainer = container.querySelector('[class*="overflow-x-auto"]');
      expect(svgContainer).toBeInTheDocument();
      expect(svgContainer?.innerHTML).toBe(svgOutput);
    });
  });

  it('should display raw source with error caption when render fails', async () => {
    mockRender.mockRejectedValue(new Error('Parse error'));

    render(<MermaidDiagram chart="invalid mermaid syntax" />);

    await waitFor(() => {
      expect(screen.getByText('Diagram could not be rendered')).toBeInTheDocument();
    });

    expect(screen.getByText('invalid mermaid syntax')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    mockRender.mockReturnValue(new Promise(() => {})); // never resolves

    render(<MermaidDiagram chart="graph TD; A-->B" />);

    expect(screen.getByText('Loading diagram…')).toBeInTheDocument();
  });

  it('should re-render when chart prop changes', async () => {
    const svg1 = '<svg><text>Diagram 1</text></svg>';
    const svg2 = '<svg><text>Diagram 2</text></svg>';
    mockRender
      .mockResolvedValueOnce({ svg: svg1 })
      .mockResolvedValueOnce({ svg: svg2 });

    const { container, rerender } = render(<MermaidDiagram chart="graph TD; A-->B" />);

    await waitFor(() => {
      expect(container.querySelector('[class*="overflow-x-auto"]')?.innerHTML).toBe(svg1);
    });

    rerender(<MermaidDiagram chart="graph TD; C-->D" />);

    await waitFor(() => {
      expect(container.querySelector('[class*="overflow-x-auto"]')?.innerHTML).toBe(svg2);
    });
  });

  it('should pass a unique ID and chart source to mermaid.render', async () => {
    mockRender.mockResolvedValue({ svg: '<svg></svg>' });

    render(<MermaidDiagram chart="graph LR; X-->Y" />);

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledWith(
        expect.stringContaining('mermaid-'),
        'graph LR; X-->Y'
      );
    });
  });

  it('should display raw source in a code block on failure', async () => {
    mockRender.mockRejectedValue(new Error('Syntax error'));
    const chartSource = 'graph TD; A-->B; B-->C';

    const { container } = render(<MermaidDiagram chart={chartSource} />);

    await waitFor(() => {
      const codeEl = container.querySelector('pre code');
      expect(codeEl).toBeInTheDocument();
      expect(codeEl?.textContent).toBe(chartSource);
    });
  });
});
