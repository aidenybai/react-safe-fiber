# <img src="https://github.com/aidenybai/bippy/blob/main/.github/assets/bippy.png?raw=true" width="60" align="center" /> bippy

a kitchen sink of utilities for working with react fiber. used internally for [`react-scan`](https://github.com/aidenybai/react-scan).

> [!WARNING]
> this project accesses react internals. this is not recommended and may break production apps - unless you acknowledge this risk and know exactly you're doing.

## example

this logs every rendered fiber in the current [commit](https://react.dev/learn/render-and-commit).

```jsx
import { instrument, traverseFiberRoot } from 'bippy'; // must be imported BEFORE react

instrument({
  onCommitFiberRoot: traverseFiberRoot({
    onRender(fiber) {
      console.log(fiber);
    },
  }),
});
```

## misc

the original bippy character is owned and created by [@dairyfreerice](https://www.instagram.com/dairyfreerice). this project is not related to the bippy brand, i just think the character is cute
