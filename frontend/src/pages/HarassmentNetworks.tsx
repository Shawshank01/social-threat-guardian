import React from 'react';
import HarassmentGraph from '../components/HarassmentGraph';

const HarassmentNetworks: React.FC = () => {
  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Harassment Networks</h1>
        <p className="text-base font-medium text-slate-600 dark:text-slate-300">
          Interactive graph visualisation representing coordinated attacks, type any word in the search bar to visualise.
           
        </p> 
      </header>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-1 shadow-sm transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
        <HarassmentGraph />
      </div>
    </section>
  );
};

export default HarassmentNetworks;
