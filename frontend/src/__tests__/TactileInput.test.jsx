import { render, screen, fireEvent } from '@testing-library/react';
import TactileInput from '../components/TactileInput';
import { ModeTactileContext } from '../App';

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
});
