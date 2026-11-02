import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Termos de Uso - FlowOS",
  description: "Termos de Uso da plataforma FlowOS",
}

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-zinc-500 mb-8">Última atualização: 2 de novembro de 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma FlowOS (&quot;nós&quot;, &quot;nosso&quot;), você concorda com estes Termos de Uso. Se não concordar, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. Sobre a Plataforma</h2>
            <p>
              A FlowOS é um sistema de cardápio digital, pedidos online e atendimento ao cliente por WhatsApp para restaurantes e estabelecimentos de alimentação. A plataforma permite que estabelecimentos criem seu cardápio online, recebam pedidos, gerenciem pagamentos e se comuniquem com clientes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. Cadastro do Estabelecimento</h2>
            <p>
              Para utilizar a plataforma, o estabelecimento deve criar uma conta informando dados verdadeiros e atualizados. O estabelecimento é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades que ocorram sob sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. Planos e Pagamentos</h2>
            <p>
              A plataforma pode oferecer planos gratuitos e pagos. Pagamentos são processados por provedores de pagamento terceiros (ex: Pagar.me, Asaas). A FlowOS não armazena dados completos de cartão de crédito; essas informações são tratadas diretamente pelos provedores de pagamento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. WhatsApp Cloud API (Meta)</h2>
            <p>
              A comunicação entre estabelecimentos e clientes via WhatsApp utiliza a WhatsApp Cloud API da Meta Platforms, Inc. O envio e recebimento de mensagens estão sujeitos aos <a href="https://www.whatsapp.com/legal/business-platform-terms/" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">Termos do WhatsApp Business Platform</a> e à <a href="https://www.facebook.com/privacy/policy/" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">Política de Dados do WhatsApp</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. Responsabilidades do Estabelecimento</h2>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Manter o cardápio, preços e disponibilidade atualizados.</li>
              <li>Processar os pedidos recebidos dentro do prazo informado.</li>
              <li>Garantir a qualidade e segurança dos alimentos e serviços oferecidos.</li>
              <li>Cumprir as leis e regulamentos locais aplicáveis ao seu negócio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Responsabilidades do Cliente</h2>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Informar dados corretos ao fazer um pedido (nome, telefone, endereço).</li>
              <li>Pagar os pedidos conforme a forma de pagamento escolhida.</li>
              <li>Utilizar a plataforma de boa-fé, sem tentativa de fraude ou abuso.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">8. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da plataforma (logos, textos, imagens, software) é de propriedade da FlowOS ou de seus licenciados e está protegido por leis de propriedade intelectual. O uso da plataforma não transfere qualquer direito de propriedade intelectual ao usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">9. Limitação de Responsabilidade</h2>
            <p>
              A FlowOS se esforça para manter a plataforma disponível e funcionando, mas não garante que o serviço estará livre de interrupções ou erros. A plataforma é fornecida &quot;no estado em que se encontra&quot;, sem garantias de qualquer tipo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">10. Privacidade e Proteção de Dados</h2>
            <p>
              O tratamento de dados pessoais pela FlowOS é regido pela nossa <a href="/politica-de-privacidade" className="text-green-600 underline">Política de Privacidade</a>, em conformidade com a LGPD (Lei Geral de Proteção de Dados).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">11. Encerramento da Conta</h2>
            <p>
              O estabelecimento pode solicitar o encerramento de sua conta a qualquer momento através da plataforma. A FlowOS também poderá suspender ou encerrar contas que violem estes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">12. Alterações nos Termos</h2>
            <p>
              Podemos atualizar estes Termos de Uso periodicamente. Alterações significativas serão notificadas através da plataforma ou por e-mail. O uso contínuo da plataforma após as alterações significa aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">13. Contato</h2>
            <p>
              Em caso de dúvidas sobre estes Termos de Uso, entre em contato:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>E-mail: admin@flowoshub.com</li>
              <li>Empresa: FlowOS</li>
              <li>Site: <a href="https://flowoshub.com" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">flowoshub.com</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
