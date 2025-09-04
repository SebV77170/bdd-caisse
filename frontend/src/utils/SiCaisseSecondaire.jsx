import { jsx } from "react/jsx-runtime";
import { useActiveSession } from "../contexts/SessionCaisseContext"

export const SiCaisseSecondaire = ({ children }) => {
    const activeSession = useActiveSession();
    return activeSession?.type === 'secondaire' ? children : null;
}

export default SiCaisseSecondaire;