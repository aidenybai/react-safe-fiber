import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import type { Fiber } from 'react-reconciler';
import type { MouseEvent } from 'react';
import {
  getRDTHook,
  getDisplayName,
  traverseFiber,
  isCompositeFiber,
  instrument,
  getNearestHostFiber,
  traverseProps,
  isHostFiber
} from 'bippy';
import { Inspector, ObjectInspector } from 'react-inspector';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { highlight } from 'sugar-high';

interface DOMRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type PropValue = string | number | boolean | undefined;

interface Props {
  [key: string]: PropValue;
}

interface Listeners {
  [key: string]: string;
}

interface Renderer {
  findFiberByHostInstance?: (instance: Element) => Fiber | null;
}

declare const __VERSION__: string;

instrument({
  onCommitFiberRoot(_, root) {
    traverseFiber(root.current, fiber => {
      if (isCompositeFiber(fiber)) {
        const hostFiber = getNearestHostFiber(fiber);
        const displayName = getDisplayName(fiber) || 'unknown';
        if (!hostFiber) return;
        const hostInstance = hostFiber.stateNode as HTMLElement;
        if (!hostInstance) return;
        hostInstance.setAttribute('react-component-name', displayName);
        const props: Props = {};
        traverseProps(fiber, (propName: string, nextValue: unknown) => {
          if (
            typeof nextValue === 'number' ||
            typeof nextValue === 'string' ||
            typeof nextValue === 'boolean' ||
            typeof nextValue === 'undefined'
          ) {
            props[propName] = nextValue;
          } else {
            props[propName] = typeof nextValue;
          }
        });
        if (Object.keys(props).length > 0) {
          hostInstance.setAttribute(
            'react-component-props',
            JSON.stringify(props)
          );
        }
      }
      if (isHostFiber(fiber)) {
        const listeners: Listeners = {};
        traverseProps(fiber, (propName: string, value: unknown) => {
          if (propName.startsWith('on') && typeof value === 'function') {
            listeners[propName] = value.toString();
          }
        });
        if (Object.keys(listeners).length > 0) {
          const hostInstance = fiber.stateNode as HTMLElement;
          if (!hostInstance) return;
          hostInstance.setAttribute(
            'react-event-listeners',
            JSON.stringify(listeners)
          );
        }
      }
    });
  }
});

const getFiberFromElement = (element: Element) => {
  const { renderers } = getRDTHook();
  for (const [_, renderer] of Array.from(renderers || [])) {
    try {
      const r = renderer as Renderer;
      const fiber = r.findFiberByHostInstance?.(element);
      if (fiber) return fiber;
    } catch {}
  }

  if ('_reactRootContainer' in element) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return (element as any)._reactRootContainer?._internalRoot?.current?.child;
  }

  for (const key in element) {
    if (
      key.startsWith('__reactInternalInstance$') ||
      key.startsWith('__reactFiber')
    ) {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      return (element as any)[key];
    }
  }
  return null;
};

const throttle = (fn: (e: globalThis.MouseEvent) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (e: globalThis.MouseEvent) => {
    if (!timeout) {
      timeout = setTimeout(() => {
        fn(e);
        timeout = null;
      }, wait);
    }
  };
};

interface TextProps {
  as?: keyof JSX.IntrinsicElements;
  children: ReactNode;
  className?: string;
}

interface LinkProps {
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}

interface ListProps {
  children: ReactNode;
  className?: string;
}

interface ListItemProps {
  children: ReactNode;
}

interface SideLayoutProps {
  children: ReactNode;
}

interface HoverOverlayProps {
  isInspectorEnabled?: boolean;
  children?: ReactNode;
}

export const HoverOverlay = ({
  isInspectorEnabled = true
}: HoverOverlayProps) => {
  const [inspected, setInspected] = useState<Fiber | null>(null);
  const [hovered, setHovered] = useState<Fiber | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (inspected) return;
      if (window.innerWidth < 800 || !isInspectorEnabled) {
        setHovered(null);
        setRect(null);
        return;
      }
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element) return;
      const fiber = getFiberFromElement(element);
      let foundInspect = false;
      traverseFiber(
        fiber,
        innerFiber => {
          if (innerFiber.type === Inspector) {
            foundInspect = true;
            return true;
          }
        },
        true
      );
      if (foundInspect) return;
      setHovered(fiber?.return || fiber);
      setRect(element.getBoundingClientRect());
    };

    const throttledMouseMove = throttle(handleMouseMove, 16);

    document.addEventListener('mousemove', throttledMouseMove);
    return () => {
      document.removeEventListener('mousemove', throttledMouseMove);
    };
  }, [isInspectorEnabled, inspected]);

  useEffect(() => {
    const handleMouseClick = (e: globalThis.KeyboardEvent) => {
      if (!isInspectorEnabled) return;
      if (e.key === 'i') {
        if (inspected) {
          setInspected(null);
          setHovered(null);
          setRect(null);
        } else {
          setInspected(hovered);
          console.info('Inspected fiber:', hovered);
        }
      }
      if (inspected && e.key === 'Escape') {
        setInspected(null);
        setHovered(null);
        setRect(null);
      }
    };
    document.addEventListener('keydown', handleMouseClick);
    return () => {
      document.removeEventListener('keydown', handleMouseClick);
    };
  }, [isInspectorEnabled, inspected, hovered]);

  const fiber = inspected || hovered;
  if (window.innerWidth < 800 || !fiber || !rect) return null;

  return (
    <>
      <div
        className="border border-black fixed bg-white z-50 p-[1ch] max-w-[50ch] transition-all duration-150 overflow-auto max-h-[40ch] shadow"
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          opacity: rect ? 1 : 0,
          transform: rect ? 'translateY(0)' : 'translateY(10px)',
          pointerEvents: rect ? 'auto' : 'none'
        }}
      >
        <div className="flex items-center gap-1 mb-[1ch] ">
          <Text
            as="h3"
            className="text-sm bg-neutral-100 px-[0.5ch] rounded-sm w-fit"
          >
            {`<${typeof fiber.type === 'string' ? fiber.type : getDisplayName(fiber) || 'unknown'}>`}
          </Text>
          {inspected && <LockIcon className="size-4" />}
        </div>
        <ObjectInspector data={fiber} expandLevel={1} table={false} />
      </div>
      <div
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          opacity: rect ? 1 : 0
        }}
        className={cn(
          'border border-dashed fixed z-40 pointer-events-none transition-all duration-150',
          inspected ? 'border-black' : 'border-neutral-400'
        )}
      />
    </>
  );
};

export function cn(...inputs: (string | undefined | boolean)[]) {
  return twMerge(clsx(inputs));
}

function SideLayout({ children }: SideLayoutProps) {
  return (
    <div className="relative leading-normal pl-[2ch] pt-[1lh] pr-[2ch] sm:pt-[2lh] sm:pl-[7ch] min-h-[100dvh] pb-[1lh] sm:max-w-[80ch]">
      {children}
    </div>
  );
}

function Text({
  as: Component = 'p',
  children,
  className,
  ...props
}: TextProps) {
  return (
    <Component className={cn('text-lg', className)} {...props}>
      {children}
    </Component>
  );
}

function Link({ children, className, href, onClick, ...props }: LinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn('underline hover:bg-black hover:text-white', className)}
      {...props}
    >
      {children}
    </a>
  );
}

function List({ children, className }: ListProps) {
  return (
    <ul
      className={cn(
        "pl-[2ch] list-disc marker:content-['→'] marker:text-neutral-400 marker:pr-[1ch] space-y-[1ch]",
        className
      )}
    >
      {children}
    </ul>
  );
}

function ListItem({ children }: ListItemProps) {
  return <li className="pl-[1ch]">{children}</li>;
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

export default function Main() {
  const [imgSize, setImgSize] = useState(50);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isInspectorEnabled, setIsInspectorEnabled] = useState(true);

  return (
    <>
      <HoverOverlay isInspectorEnabled={isInspectorEnabled} />
      <SideLayout>
        <div className="flex items-center gap-[1ch]">
          <div className="flex items-center gap-[0.5ch]">
            <img
              src="/bippy.png"
              alt="bippy logo"
              className={cn('select-none', isSpinning && 'animate-spin')}
              width={imgSize}
              height={imgSize}
              onClick={() => setImgSize(imgSize + 10)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setImgSize(imgSize + 10);
                }
              }}
              onMouseEnter={() => setIsSpinning(true)}
              onMouseLeave={() => setIsSpinning(false)}
            />
            <Text className="font-bold text-2xl" as="h1">
              bippy
            </Text>
          </div>
          <Link
            href="https://github.com/aidenybai/bippy"
            className="hidden sm:flex"
          >
            <Text as="span">{__VERSION__}</Text>
          </Link>
          <div className="ml-auto flex gap-[1ch] my-[1ch]">
            <span className="hidden sm:flex gap-[1ch]">
              <Text
                className={cn(
                  'text-muted-foreground opacity-50',
                  isInspectorEnabled && 'opacity-100'
                )}
              >
                <Link
                  onClick={() => setIsInspectorEnabled(!isInspectorEnabled)}
                >
                  inspect ({isInspectorEnabled ? 'ON' : 'OFF'})
                </Link>
              </Text>{' '}
              &middot;
            </span>
            <Text className="text-muted-foreground">
              <Link href="https://github.com/aidenybai/bippy">/github</Link>
            </Text>
          </div>
        </div>

        <hr className="my-[1ch] border-neutral-200" />

        <div className="flex flex-col gap-[1ch] my-[2ch]">
          <Text className="text-muted-foreground">
            bippy is a toolkit to{' '}
            <Text as="span" className="font-bold">
              hack into react internals
            </Text>
          </Text>
        </div>

        <div className="flex flex-col gap-[1ch] my-[2ch]">
          <Text className="text-muted-foreground">
            by default, you cannot access react internals. bippy bypasses this
            by "pretending" to be react devtools, giving you access to the fiber
            tree and other internals.
          </Text>
        </div>

        <List className="my-[2ch]">
          <ListItem>
            <Text className="text-muted-foreground">
              works outside of react – no react code modification needed
            </Text>
          </ListItem>
          <ListItem>
            <Text className="text-muted-foreground">
              utility functions that work across modern react (v17-19)
            </Text>
          </ListItem>
          <ListItem>
            <Text className="text-muted-foreground">
              no prior react source code knowledge required
            </Text>
          </ListItem>
        </List>

        <div className="flex flex-col gap-[1ch] my-[1ch]">
          <Text className="text-muted-foreground">
            you can get started in {'<'}6 lines of code:
          </Text>
        </div>
        <pre className="bg-black p-[1.5ch] sm:p-[2ch] rounded-lg">
          <code
            className="whitespace-pre-wrap"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: OK
            dangerouslySetInnerHTML={{
              __html:
                highlight(`import { onCommitFiberRoot, traverseFiber } from 'bippy';

onCommitFiberRoot((root) => {
  traverseFiber(root.current, (fiber) => {
    console.log('fiber:', fiber);
  });
})`)
            }}
          />
        </pre>

        <div className="flex my-[2ch]">
          <a href="https://github.com/aidenybai/bippy">
            <button
              type="button"
              className="bg-neutral-200 text-black px-[1ch] py-[0.5ch] rounded-sm hover:bg-neutral-300 transition-all duration-150 font-bold text-lg"
            >
              try bippy →
            </button>
          </a>
        </div>

        <div className="bg-[#eda33b]/25 text-black p-[1ch] my-[2ch] font-sans">
          <div>
            <Text className="text-xs">
              <Text as="span" className="text-xs font-bold">
                ⚠️ warning:{' '}
              </Text>
              <Text as="span" className="text-xs">
                this project may break production apps and cause unexpected
                behavior
              </Text>
            </Text>
          </div>
          <div className="mt-[1ch]">
            <Text className="text-xs">
              this project uses react internals, which can change at any time.
              it is not recommended to depend on internals unless you really,{' '}
              <Text as="span" className="text-xs italic">
                really have to.
              </Text>{' '}
              by proceeding, you acknowledge the risk of breaking your own code
              or apps that use your code.
            </Text>
          </div>
        </div>
      </SideLayout>
    </>
  );
}

export const Route = createFileRoute('/')({
  component: Main
});
