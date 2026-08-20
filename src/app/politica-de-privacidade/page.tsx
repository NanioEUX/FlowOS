import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de Privacidade - FlowOS",
  description: "Política de Privacidade da plataforma FlowOS",
}

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-zinc-500 mb-8">Última atualização: 19 de agosto de 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">1. Introdução</h2>
            <p>
              A FlowOS (&quot;nós&quot;, &quot;nosso&quot;) opera a plataforma FlowOS, um sistema de cardápio digital, pedidos online e atendimento ao cliente por WhatsApp para restaurantes e estabelecimentos de alimentação. Esta Política de Privacidade descreve como coletamos, usamos, protegemos e compartilhamos informações quando você utiliza nossa plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">2. Dados que Coletamos</h2>
            <h3 className="font-semibold text-zinc-800 mt-4 mb-2">2.1 Dados de Usuários da Plataforma (Restaurantes/Estabelecimentos)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome, e-mail e telefone</li>
              <li>Senha (armazenada de forma criptografada)</li>
              <li>Dados do estabelecimento (nome, endereço, logo, horário de funcionamento)</li>
              <li>Informações de pagamento (quando aplicável)</li>
            </ul>

            <h3 className="font-semibold text-zinc-800 mt-4 mb-2">2.2 Dados de Clientes Finais (Consumidores)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome e telefone (fornecidos ao fazer pedido)</li>
              <li>Endereço de entrega e CEP</li>
              <li>CPF (quando necessário para pagamento)</li>
              <li>E-mail (quando fornecido pelo cliente)</li>
            </ul>

            <h3 className="font-semibold text-zinc-800 mt-4 mb-2">2.3 Dados de Pedidos</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Itens pedidos, valores e forma de pagamento</li>
              <li>Status do pedido (preparando, em entrega, entregue)</li>
              <li>Histórico de pedidos anteriores</li>
            </ul>

            <h3 className="font-semibold text-zinc-800 mt-4 mb-2">2.4 Dados de Comunicação via WhatsApp</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Mensagens trocadas entre o restaurante e o cliente</li>
              <li>Conteúdo relacionado a pedidos e atendimento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">3. Como Usamos os Dados</h2>
            <p>Utilizamos os dados coletados para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Processar e gerenciar pedidos online</li>
              <li>Enviar confirmações de pedido e notificações de status</li>
              <li>Facilitar a comunicação entre restaurante e cliente via WhatsApp</li>
              <li>Gerenciar contas de usuário e estabelecimentos</li>
              <li>Processar pagamentos</li>
              <li>Fornecer suporte ao cliente</li>
              <li>Melhorar nossos serviços e experiência do usuário</li>
              <li>Gerenciar programa de fidelidade e cashback</li>
              <li>Enviar notificações push sobre pedidos (quando autorizado pelo usuário)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">4. WhatsApp Cloud API (Meta)</h2>
            <p>
              A FlowOS utiliza a WhatsApp Cloud API da Meta Platforms, Inc. para permitir a comunicação entre restaurantes e seus clientes. As mensagens enviadas e recebidas pela plataforma são processadas pela Meta de acordo com a <a href="https://www.facebook.com/privacy/policy/" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">Política de Privacidade do Facebook</a> e os <a href="https://www.whatsapp.com/legal/business-platform-terms/" className="text-green-600 underline" target="_blank" rel="noopener noreferrer">Termos do WhatsApp Business Platform</a>.
            </p>
            <p className="mt-2">
              As mensagens são utilizadas exclusivamente para fins transacionais (confirmações de pedido, status de entrega, suporte ao cliente) e não são utilizadas para marketing ou disparos em massa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">5. Compartilhamento de Dados</h2>
            <p>Podemos compartilhar dados nas seguintes situações:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Com o restaurante:</strong> Os dados do cliente (nome, telefone, endereço, pedido) são compartilhados com o restaurante selecionado para processar o pedido.</li>
              <li><strong>Com prestadores de serviços:</strong> Processadores de pagamento, serviços de entrega e provedores de infraestrutura (ex: hosting). Esses terceiros são obrigados a proteger seus dados.</li>
              <li><strong>Com plataformas de mensagens:</strong> Meta (WhatsApp) para envio/recebimento de mensagens.</li>
              <li><strong>Por obrigação legal:</strong> Quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">6. Segurança dos Dados</h2>
            <p>
              Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia de senhas, acesso restrito a dados pessoais e monitoramento de segurança. No entanto, nenhum método de transmissão pela internet ou armazenamento é 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">7. Retenção de Dados</h2>
            <p>
              Mantemos seus dados pelo tempo necessário para fornecer nossos serviços ou conforme exigido por lei. Dados de pedidos podem ser mantidos por até 5 anos para fins fiscais. Você pode solicitar a exclusão de seus dados pessoais entrando em contato conosco.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">8. Seus Direitos</h2>
            <p>De acordo com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Solicitar a portabilidade dos dados</li>
              <li>Revogar consentimento para uso de dados</li>
              <li>Solicitar informações sobre o uso de seus dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação, sessão). Não utilizamos cookies de rastreamento ou publicitários sem seu consentimento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">10. Menores de Idade</h2>
            <p>
              Nossos serviços não são direcionados a menores de 18 anos. Não coletamos intencionalmente dados de menores de idade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">11. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações significativas através da plataforma ou por e-mail.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">12. Contato</h2>
            <p>
              Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de seus dados, entre em contato:
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
