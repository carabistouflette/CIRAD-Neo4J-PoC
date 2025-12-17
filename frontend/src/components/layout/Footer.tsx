export function Footer() {
    return (
        <footer className="mt-12 py-6 border-t-2 border-neo-black opacity-60 hover:opacity-100 transition-opacity">
            <div className="flex flex-col md:flex-row justify-between items-center text-xs font-bold uppercase gap-2">
                <div>&copy; 2025 CIRAD - Tous droits réservés</div>
                <div className="flex gap-4">
                    <a href="#" className="hover:text-neo-primary hover:underline">Mentions Légales</a>
                    <a href="#" className="hover:text-neo-primary hover:underline">Contact</a>
                    <a href="#" className="hover:text-neo-primary hover:underline">Documentation</a>
                </div>
            </div>
        </footer>
    );
}
