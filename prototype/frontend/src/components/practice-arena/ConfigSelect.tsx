export interface ConfigSelectProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function ConfigSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: ConfigSelectProps<T>) {
  return (
    <div>
      <label className="block text-xs text-secondary mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-surface border border-white/10 rounded px-3 py-2 text-sm text-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
