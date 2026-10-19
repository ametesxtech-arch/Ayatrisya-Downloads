import { useCallback, useEffect, useRef, useState } from "react";
import { repository } from "./repository";
export function useLocalQuery<T>(query: () => Promise<T>, deps: unknown[] = []) {
  const fn = useRef(query); fn.current = query;
  const [version,setVersion] = useState(0);
  const key = `${repository.ownerId}:${JSON.stringify(deps)}`;
  const [state,setState] = useState<{key:string;data:T|undefined;loading:boolean;error:string|null}>({key,data:undefined,loading:true,error:null});
  const refresh = useCallback(() => setVersion(v => v + 1),[]);
  useEffect(() => repository.subscribe(refresh),[refresh]);
  useEffect(() => {
    let active = true;
    setState(previous => ({key,data:previous.key===key ? previous.data : undefined,loading:true,error:null}));
    fn.current().then(data => { if (active) setState({ key,data,loading:false,error:null }); }).catch(error => { if (active) setState({key,data:undefined,loading:false,error:error instanceof Error ? error.message : "Could not read local data."}); });
    return () => { active = false; };
  },[version,key]);
  return { ...(state.key===key ? state : {data:undefined,loading:true,error:null}),refresh };
}
