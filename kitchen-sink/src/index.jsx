import ReactDOM from 'react-dom/client';
import './main.css';

const projects = import.meta.glob('./tests/*', {
  eager: false,
});

const PROJECT = 'main';

export const root = ReactDOM.createRoot(document.getElementById('root'));
const render = async () => {
  const Component = (await projects[`./tests/${PROJECT}.jsx`]()).default;
  root.render(<Component />);
};

render();
