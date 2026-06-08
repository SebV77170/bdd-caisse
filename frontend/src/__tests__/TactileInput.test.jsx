import { render, screen, fireEvent } from '@testing-library/react';
import TactileInput from '../components/TactileInput';
import { ModeTactileContext } from '../contexts/ModeTactileContext';

function renderTactile(element) {
  return render(
    <ModeTactileContext.Provider value={{ modeTactile: true, setModeTactile: () => {} }}>
      {element}
    </ModeTactileContext.Provider>
  );
}

describe('TactileInput in tactile mode', () => {
  const cases = [
    { name: 'text input', props: { type: 'text', placeholder: 'txt' }, check: () => expect(screen.getByText('Espace')).toBeInTheDocument() },
    { name: 'textarea', props: { as: 'textarea', placeholder: 'area' }, check: () => expect(screen.getByText('Espace')).toBeInTheDocument() },
    { name: 'password input', props: { type: 'password', placeholder: 'pwd' }, check: () => expect(screen.getByText('Espace')).toBeInTheDocument() },
    { name: 'number input', props: { type: 'number', placeholder: 'num' }, check: () => expect(screen.getByText('1')).toBeInTheDocument() },
  ];

  cases.forEach(({ name, props, check }) => {
    test(`${name} opens modal on click`, () => {
      renderTactile(<TactileInput value="" onChange={() => {}} {...props} />);
      const input = screen.getByPlaceholderText(props.placeholder);
      fireEvent.click(input);
      check();
    });
  });

  test('renders a normal editable input outside tactile mode', () => {
    const onChange = jest.fn();
    render(
      <ModeTactileContext.Provider value={{ modeTactile: false, setModeTactile: () => {} }}>
        <TactileInput value="abc" onChange={onChange} placeholder="normal" />
      </ModeTactileContext.Provider>
    );

    const input = screen.getByPlaceholderText('normal');
    expect(input).not.toHaveAttribute('readonly');
    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(onChange).toHaveBeenCalled();
  });
});
