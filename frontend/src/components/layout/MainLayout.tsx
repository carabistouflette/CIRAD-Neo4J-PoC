import type { ReactNode } from 'react';

interface MainLayoutProps {
    children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="min-h-screen bg-neo-bg text-neo-black p-4 lg:p-8 font-mono">
            <div className="max-w-7xl mx-auto flex flex-col gap-8">
                {children}
            </div>
        </div>
    );
}
