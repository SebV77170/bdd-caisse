import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DevModeContext } from '../contexts/DevModeContext';

const LOCAL_MYSQL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function isRemoteMysqlHost(host) {
  return Boolean(host) && !LOCAL_MYSQL_HOSTS.has(String(host).trim().toLowerCase());
}

function RemoteMysqlWarning() {
  const { devMode } = useContext(DevModeContext);
  const [config, setConfig] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const isFrontendDevelopment = process.env.NODE_ENV !== 'production';
  const isBackendDevelopment = config?.runtimeEnv && config.runtimeEnv !== 'production';
  const isDevContext = devMode || isFrontendDevelopment || isBackendDevelopment;

  const fetchMysqlConfig = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/dbconfig');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfig(data);
      setLoaded(true);
    } catch (err) {
      console.error('Erreur lecture configuration MySQL:', err);
      setConfig(null);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchMysqlConfig();

    window.addEventListener('focus', fetchMysqlConfig);
    window.addEventListener('mysql-config-updated', fetchMysqlConfig);

    return () => {
      window.removeEventListener('focus', fetchMysqlConfig);
      window.removeEventListener('mysql-config-updated', fetchMysqlConfig);
    };
  }, [fetchMysqlConfig]);

  const showWarning = useMemo(() => {
    return isDevContext && loaded && isRemoteMysqlHost(config?.host);
  }, [config?.host, isDevContext, loaded]);

  if (!showWarning) return null;

  const activeSources = [
    devMode && 'mode DEV',
    isFrontendDevelopment && 'interface en développement',
    isBackendDevelopment && 'backend en développement'
  ].filter(Boolean);
  const sourceLabel = activeSources.join(' + ');

  return (
    <div className="remote-mysql-warning" role="alert">
      <strong>⚠️ MySQL REMOTE actif</strong>
      <span>
        {` ${sourceLabel} : la base MySQL configurée est distante (${config.host}${config.port ? `:${config.port}` : ''}/${config.database || 'base inconnue'}). Attention, toute modification peut impacter la base utilisée en production.`}
      </span>
    </div>
  );
}

export default RemoteMysqlWarning;
