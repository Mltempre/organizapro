import type { Metadata } from "next";
import DocumentoLegal, { EmailContato, Secao } from "../components/legal/DocumentoLegal";

// Base: docs/politica-de-privacidade-v1.md (V1 aprovada). Adaptações: contato
// oficial por e-mail e a seção 4 (Google Business Profile), que descreve
// somente o que o código faz hoje — lib/google-business-profile*.ts,
// app/google-presenca/page.tsx e app/api/ia/route.ts.
export const metadata: Metadata = {
  title: "Política de Privacidade — OrganizaPro",
  description: "Como o OrganizaPro coleta, usa, armazena e protege dados, incluindo a integração com o Google Business Profile.",
};

const lista = { margin: "8px 0", paddingLeft: 22 } as const;

export default function PoliticaDePrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de Privacidade" atualizadoEm="setembro de 2026">
      <Secao titulo="1. Quem somos">
        <p>O OrganizaPro é um produto da <strong>MLT EMPREENDIMENTOS DIGITAIS LTDA</strong>, empresa dedicada ao desenvolvimento de soluções digitais para gestão de negócios, disponível em organizaprooficial.com.br.</p>
        <p>Levamos a privacidade das suas informações a sério. Este documento explica de forma clara quais dados coletamos, para que os usamos e como os protegemos.</p>
      </Secao>

      <Secao titulo="2. Quais dados coletamos">
        <p>Ao utilizar o OrganizaPro, coletamos apenas as informações necessárias para o funcionamento da plataforma:</p>
        <p><strong>Dados fornecidos por você:</strong></p>
        <ul style={lista}>
          <li>Nome e razão social</li>
          <li>E-mail e telefone (WhatsApp)</li>
          <li>Informações do seu negócio (endereço, horários, logotipo)</li>
          <li>Dados cadastrados na plataforma (clientes, agendamentos, mensagens)</li>
        </ul>
        <p><strong>Dados técnicos de funcionamento:</strong></p>
        <ul style={lista}>
          <li>Informações de acesso e autenticação</li>
          <li>Registros de uso da plataforma (logs internos)</li>
          <li>Dados necessários para integrações que você mesmo configurar (como WhatsApp via Z-API e Google Business Profile — ver seção 4)</li>
        </ul>
        <p>Não coletamos dados sensíveis como documentos pessoais, dados bancários ou informações de saúde.</p>
      </Secao>

      <Secao titulo="3. Como utilizamos esses dados">
        <p>Os dados coletados são utilizados exclusivamente para:</p>
        <ul style={lista}>
          <li><strong>Funcionamento da plataforma:</strong> permitir que você acesse e use todos os recursos do OrganizaPro</li>
          <li><strong>Suporte:</strong> entender e resolver dúvidas ou problemas que você nos reportar</li>
          <li><strong>Comunicação:</strong> enviar avisos importantes sobre o serviço, atualizações e melhorias</li>
          <li><strong>Melhoria contínua:</strong> identificar pontos de aprimoramento da plataforma de forma agregada e anônima</li>
        </ul>
        <p>Não utilizamos seus dados para fins de publicidade de terceiros.</p>
      </Secao>

      <Secao titulo="4. Integração com o Google Business Profile">
        <p><strong>4.1 Conexão opcional, autorizada por você.</strong> A integração é opcional. Ela só é ativada quando um usuário autorizado da sua empresa clica em “Conectar com Google” na área Google Presença e concede a autorização na própria página do Google, por meio do protocolo OAuth 2.0. O OrganizaPro solicita um único escopo — <code>business.manage</code>, de gerenciamento do Perfil da Empresa — e nunca recebe nem armazena a sua senha do Google.</p>
        <p><strong>4.2 Dados do Google acessados.</strong> Com a autorização, o OrganizaPro pode acessar, do perfil conectado:</p>
        <ul style={lista}>
          <li>a identificação da conta e da localização (identificadores e nome do local);</li>
          <li>as avaliações do perfil: nota, comentário, nome público do avaliador, data e a resposta já publicada, se houver;</li>
          <li>métricas de desempenho do perfil dos últimos 30 dias: visualizações no Google Maps (computador e celular), cliques para ligar e cliques para o site.</li>
        </ul>
        <p><strong>4.3 Finalidade.</strong> Esses dados são usados exclusivamente para mostrar a você as avaliações e o desempenho do seu perfil dentro do OrganizaPro e para ajudar você a responder aos seus clientes. O OrganizaPro só escreve no seu perfil — respostas a avaliações e publicações — quando um usuário autorizado da sua empresa solicita e aprova explicitamente cada ação. Nenhuma resposta é publicada automaticamente.</p>
        <p><strong>4.4 Sugestões de resposta com inteligência artificial.</strong> Quando você clica em “Gerar rascunho”, o nome da sua empresa, a nota e o comentário da avaliação são enviados ao nosso provedor de inteligência artificial (OpenAI) apenas para gerar uma sugestão de texto. O nome do avaliador não é enviado. A sugestão só é publicada se você a revisar e aprovar. O OrganizaPro não utiliza dados obtidos do Google para treinar modelos de inteligência artificial.</p>
        <p><strong>4.5 O que armazenamos.</strong> Para manter a conexão funcionando, guardamos somente:</p>
        <ul style={lista}>
          <li>os identificadores da conta e da localização e o nome do local conectado;</li>
          <li>o token de atualização (refresh token) concedido pelo Google, armazenado de forma criptografada (AES-256-GCM), além dos escopos concedidos e da data da conexão;</li>
          <li>os rascunhos de resposta que você salvar e o registro das respostas e publicações feitas pelo OrganizaPro (texto, identificação da avaliação ou publicação e data), para o seu histórico e para evitar publicações duplicadas.</li>
        </ul>
        <p>As avaliações e as métricas são consultadas diretamente no Google no momento em que você as visualiza e não são armazenadas de forma permanente pelo OrganizaPro. Os tokens de acesso temporários também não são armazenados.</p>
        <p><strong>4.6 Uso limitado.</strong> O uso e a transferência, pelo OrganizaPro, de informações recebidas das APIs do Google seguem a{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#0f766e" }}>Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de Uso Limitado. Os dados do Google não são vendidos, não são usados para publicidade e não são transferidos a terceiros, exceto aos provedores de infraestrutura e de inteligência artificial descritos nesta política, na medida necessária para prestar o serviço, ou quando exigido por lei. Eles ficam acessíveis apenas aos usuários autorizados da sua própria empresa.</p>
        <p><strong>4.7 Como revogar.</strong> Você pode encerrar a integração a qualquer momento:</p>
        <ul style={lista}>
          <li>no OrganizaPro, em Google Presença → “Desconectar”, o que remove a conexão e o token armazenado;</li>
          <li>ou na sua Conta do Google, em{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: "#0f766e", overflowWrap: "anywhere" }}>myaccount.google.com/permissions</a>, removendo o acesso do OrganizaPro.</li>
        </ul>
        <p>Após a revogação, o OrganizaPro deixa de acessar o seu perfil. O histórico de rascunhos e de respostas já publicadas permanece na sua conta do OrganizaPro; a exclusão desses registros pode ser solicitada pelo contato oficial (seção 8).</p>
      </Secao>

      <Secao titulo="5. Compartilhamento de dados">
        <p>Seus dados <strong>não são vendidos</strong> a ninguém, em nenhuma hipótese.</p>
        <p>Poderemos compartilhar informações apenas nas seguintes situações:</p>
        <ul style={lista}>
          <li>Com fornecedores de infraestrutura essenciais para o funcionamento da plataforma (como serviços de hospedagem, banco de dados e autenticação), sempre com cláusulas de confidencialidade</li>
          <li>Com o provedor de inteligência artificial, somente quando você usa um recurso que gera sugestões de texto (ver seção 4.4)</li>
          <li>Quando exigido por lei ou determinação judicial</li>
        </ul>
        <p>Qualquer parceiro técnico envolvido na operação da plataforma está sujeito às mesmas obrigações de proteção de dados que nós assumimos com você.</p>
      </Secao>

      <Secao titulo="6. Segurança">
        <p>Adotamos boas práticas de segurança da informação para proteger os seus dados, incluindo:</p>
        <ul style={lista}>
          <li>Autenticação segura com criptografia de senha</li>
          <li>Controle de acesso por empresa (cada cliente acessa apenas os seus próprios dados)</li>
          <li>Conexões protegidas via HTTPS</li>
          <li>Tokens de integrações, como o do Google, armazenados de forma criptografada</li>
          <li>Monitoramento e atualizações regulares da infraestrutura</li>
        </ul>
        <p>Nenhum sistema é 100% infalível. Por isso, recomendamos que você também mantenha sua senha em sigilo e atualize-a periodicamente.</p>
      </Secao>

      <Secao titulo="7. Seus direitos">
        <p>De acordo com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>, você tem os seguintes direitos sobre suas informações:</p>
        <ul style={lista}>
          <li><strong>Acesso:</strong> saber quais dados temos sobre você</li>
          <li><strong>Correção:</strong> solicitar a atualização de informações incorretas ou desatualizadas</li>
          <li><strong>Atualização:</strong> manter seus dados sempre precisos</li>
          <li><strong>Exclusão:</strong> solicitar a remoção dos seus dados, quando aplicável e permitido por lei</li>
        </ul>
        <p>Para exercer qualquer um desses direitos, entre em contato pelo e-mail <EmailContato />.</p>
      </Secao>

      <Secao titulo="8. Contato">
        <p>Todas as solicitações relacionadas à privacidade, à proteção de dados, à integração com o Google ou ao exercício dos seus direitos podem ser feitas pelo e-mail oficial <EmailContato />.</p>
        <p>Respondemos todas as solicitações em até <strong>10 dias úteis</strong>.</p>
      </Secao>

      <Secao titulo="9. Atualizações desta política">
        <p>Esta política pode ser atualizada sempre que necessário para refletir melhorias nos nossos processos ou mudanças na legislação. Quando isso acontecer, comunicaremos você com antecedência pelos nossos canais.</p>
        <p>A data de atualização sempre estará indicada no topo deste documento.</p>
      </Secao>
    </DocumentoLegal>
  );
}
