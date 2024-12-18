import {
  instrument,
  isHostFiber,
  getNearestHostFiber,
  createFiberVisitor,
  isCompositeFiber,
  getDisplayName,
  traverseFiber,
  traverseProps,
} from 'bippy'; // must be imported BEFORE react
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const components = {};

window.components = components;

instrument({
  onCommitFiberRoot(rendererID, root) {
    traverseFiber(root.current, (fiber) => {
      if (isCompositeFiber(fiber)) {
        const displayName = getDisplayName(fiber);
        const hostFiber = getNearestHostFiber(fiber);
        if (!hostFiber) return;

        const listeners = [];

        traverseFiber(fiber, (innerFiber) => {
          if (isHostFiber(innerFiber)) {
            traverseProps(innerFiber, (propName, value) => {
              if (propName.startsWith('on')) {
                listeners.push(value);
              }
            });
          }
        });

        components[displayName] = {
          fiber,
          element: hostFiber.stateNode,
          listeners,
        };
      }
    });
  },
});

function TodoList() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos([...todos, { text: input, completed: false }]);
    setInput('');
  };

  const toggleComplete = (index) => {
    setTodos(
      todos.map((todo, i) =>
        i === index ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  };

  const deleteTodo = (index) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2>Todo List</h2>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && addTodo()}
      />
      <button onClick={addTodo}>Add Todo</button>
      <ul>
        {todos.map((todo, index) => (
          <li key={index}>
            <span
              onClick={() => toggleComplete(index)}
              style={{
                textDecoration: todo.completed ? 'line-through' : 'none',
                cursor: 'pointer',
              }}
            >
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(index)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<TodoList />);
