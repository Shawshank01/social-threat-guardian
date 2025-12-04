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
  
        <div style={{ display: 'flex',  flexDirection: 'column', gap:'24px'}}>
          <p>The graph includes metrics that are explained below:</p>
        </div>
        <div>
        <strong>Average Degree(K)</strong>
          <p style={{margin:0}}>Average degree measures the average number of connections a user has.</p>
        </div>
        <div>
          <strong>Assortativity (r)</strong>
          <p style={{margin:0}}>
            This is the tendency of users to connect with other users of similar characteristics and is represented by r.
          
           if r is greater than 0 it means its assortative and likely that coordinated aggressors are conneted to each other

            and if r is less than 0 it means its disassortative which means that aggressors are likely to attack random users.
            </p>
        </div>
        <div>
        <strong>Clustering coefficient (C)</strong>
        <p style={{margin:0}}>
         Measures the cliqueness(closed triangles) in a network.

           It ranges from 0 to 1, where zero indicates a star which in other words means no cliques meaning random aggressors attacking random victims.

           One indicates a complete clique that is likely to coordinate an attack together.
        </p>
        </div>

        <div>
          <strong>Hub threshold</strong>
          <p style={{margin:0}}>
           indicates that users with a number higher than this value are considered hubs or ring leaders in the harassment networks.
          </p>
        </div>
        
      </header>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-1 shadow-sm transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
        <HarassmentGraph />
      </div>
    </section>
  );
};

export default HarassmentNetworks;
