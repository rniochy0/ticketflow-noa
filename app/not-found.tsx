import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={
      { 
        textAlign: 'center', 
        padding: '50px' 
        }
        }>
      <h2>{"Página Não Encontrada"}</h2>
      <p>{"Lamentamos, mas a página que procura não existe ou foi movida."}</p>
      <Link 
        href="/" 
        style={
            { 
              color: 'blue', 
              textDecoration: 'none', 
              marginTop: '20px', 
              display: 'inline-block',
              border: '1px solid gray',
              padding: '10px 20px',
              borderRadius: '5px',
              backgroundColor: '#f0f0f0' 

          >
                {"Voltar para a Página Inicial"}
      </Link>
    </div>
  );
}