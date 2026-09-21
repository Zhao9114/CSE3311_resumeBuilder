import { TEMPLATES, type TemplateId } from '../../types'

interface TemplatePickerProps {
  value: TemplateId
  onChange: (id: TemplateId) => void
}

/** Switches the resume's look. Content and block order are untouched. */
export default function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div className="template-picker">
      <span id="template-picker-label">Template</span>
      <div
        className="template-options"
        role="group"
        aria-labelledby="template-picker-label"
      >
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className="template-option"
            aria-pressed={value === tpl.id}
            title={tpl.description}
            onClick={() => onChange(tpl.id)}
          >
            {tpl.name}
          </button>
        ))}
      </div>
    </div>
  )
}
