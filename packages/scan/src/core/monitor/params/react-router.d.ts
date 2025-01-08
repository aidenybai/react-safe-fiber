declare module 'react-router' {
  export interface Location {
    pathname: string;
    search: string;
    hash: string;
    state: unknown;
  }

  export interface Match<Params = { [K in keyof Params]?: string }> {
    params: Params;
    isExact: boolean;
    path: string;
    url: string;
  }

  // v5 hooks
  export function useRouteMatch<
    Params = Record<string, string>,
  >(): Match<Params> | null;
  export function useLocation(): Location;

  // v6 hooks
  export function useParams<Params = Record<string, string>>(): Params;
}
