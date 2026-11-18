/**
 * Small document-building helpers shared by the settings dialog sections.
 * The dialog is a vanilla custom element, so every section builds nodes here
 * instead of a template literal.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * Stable identity for a control, so a repaint can put keyboard focus back on
 * the same field. Labels are unique within the dialog.
 */
export function setFocusKey(node: HTMLElement, key: string): void {
    node.setAttribute('data-focus-key', key);
}

/** A plain `<button>`: no form lives in the dialog, so no submit default. */
export function button(className: string, label: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
    const node = el('button', className, label);
    node.type = 'button';
    setFocusKey(node, `button:${label}`);
    node.addEventListener('click', onClick);
    return node;
}

export interface SelectOption {
    value: string;
    label: string;
}

/**
 * A labelled `<select>` in the Reading grid. The value is assigned after the
 * options exist, or the select would keep the first option instead of the
 * saved one.
 */
export function selectField(
    label: string,
    options: SelectOption[],
    value: string,
    onChange: (value: string) => void,
): HTMLLabelElement {
    const field = el('label', 'view-field');
    field.append(el('span', undefined, label));
    const select = el('select');
    setFocusKey(select, `select:${label}`);
    for (const option of options) {
        const node = el('option', undefined, option.label);
        node.value = option.value;
        select.append(node);
    }
    select.value = value;
    select.addEventListener('change', () => onChange(select.value));
    field.append(select);
    return field;
}

/** A checkbox row, used for share targets and for the Reading toggles. */
export function checkboxField(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
    const field = el('label', 'share-target');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = checked;
    setFocusKey(input, `check:${label}`);
    input.addEventListener('change', () => onChange(input.checked));
    field.append(input, document.createTextNode(label));
    return field;
}

/** A `.section` with its heading. Callers append that section's own rows. */
export function section(title: string): HTMLElement {
    const root = el('div', 'section');
    root.append(el('h3', undefined, title));
    return root;
}

export function hint(text: string, extraClass?: string): HTMLParagraphElement {
    return el('p', extraClass ? `hint ${extraClass}` : 'hint', text);
}

/** The one-line result under a section; `error` colours it like a failure. */
export function statusLine(text: string, isError: boolean): HTMLElement {
    return el('div', isError ? 'status error' : 'status', text);
}
