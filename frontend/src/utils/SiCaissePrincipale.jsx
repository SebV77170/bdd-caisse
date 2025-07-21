import { jsx } from "react/jsx-runtime";
import { useActiveSession } from "../contexts/SessionCaisseContext"

export const SiCaissePrincipale = ({ children }) => {
    const activeSession = useActiveSession();
    return activeSession?.type === 'principale' ? children : null;
}

export default SiCaissePrincipale;