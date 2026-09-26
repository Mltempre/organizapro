import type { Metadata } from "next";
import Link from "next/link";
import DocumentoLegal, { EmailContato, Secao } from "../components/legal/DocumentoLegal";

// Base: docs/termos-de-uso-v1.md (V1.0). Adaptações mínimas: contato oficial
// por e-mail, link para a Política de Privacidade e a seção 8, que citava uma
// regra de exportação inexistente na política — agora aponta para o contato.
export const metadata: Metadata = {
  title: "Termos de Uso — OrganizaPro",
  description: "Termos que regulam o uso da plataforma OrganizaPro.",
};

const lista = { margin: "8px 0", paddingLeft: 22 } as const;

export default function TermosDeUsoPage() {
  return (
    <DocumentoLegal titulo="Termos de Uso" atualizadoEm="setembro de 2026">
      <Secao titulo="1. Apresentação">
        <p>Estes Termos de Uso regulam a utilização da plataforma <strong>OrganizaPro</strong>, produto da <strong>MLT EMPREENDIMENTOS DIGITAIS LTDA</strong>, desenvolvida para auxiliar empresários e profissionais na organização de clientes, agendamentos e rotinas do negócio.</p>
        <p>Ao acessar ou utilizar a plataforma, o cliente confirma que leu, compreendeu e concorda com os termos descritos neste documento. O tratamento de dados pessoais é descrito na <Link href="/privacidade" style={{ color: "#0f766e" }}>Política de Privacidade</Link>.</p>
      </Secao>

      <Secao titulo="2. Aceitação">
        <p>O uso da plataforma OrganizaPro implica a aceitação integral destes Termos de Uso.</p>
        <p>Caso não concorde com algum dos termos aqui descritos, recomendamos que entre em contato com a OrganizaPro antes de continuar utilizando o serviço.</p>
      </Secao>

      <Secao titulo="3. Acesso à plataforma">
        <p>O acesso à plataforma é <strong>individual e intransferível</strong>. Cada usuário possui credenciais próprias de acesso (e-mail e senha).</p>
        <p>O cliente é responsável por:</p>
        <ul style={lista}>
          <li>Manter sua senha em sigilo e não compartilhá-la com terceiros</li>
          <li>Comunicar imediatamente à OrganizaPro em caso de acesso não autorizado à sua conta</li>
          <li>Todas as ações realizadas dentro da plataforma com as suas credenciais</li>
        </ul>
      </Secao>

      <Secao titulo="4. Utilização">
        <p>O cliente compromete-se a utilizar o OrganizaPro de forma <strong>lícita</strong>, respeitando a legislação brasileira vigente e as finalidades para as quais a plataforma foi desenvolvida.</p>
        <p><strong>É proibido:</strong></p>
        <ul style={lista}>
          <li>Tentar acessar contas ou dados de outros usuários</li>
          <li>Utilizar a plataforma para fins ilícitos, fraudulentos ou que causem danos a terceiros</li>
          <li>Tentar comprometer, sobrecarregar ou interferir na segurança e no funcionamento do sistema</li>
          <li>Reproduzir, copiar ou distribuir qualquer parte da plataforma sem autorização expressa</li>
        </ul>
        <p>O descumprimento destas regras pode resultar no encerramento imediato do acesso, sem aviso prévio.</p>
      </Secao>

      <Secao titulo="5. Disponibilidade">
        <p>A OrganizaPro empenha-se em manter a plataforma disponível de forma contínua e estável.</p>
        <p>Poderão ocorrer interrupções breves para:</p>
        <ul style={lista}>
          <li>Manutenções programadas (comunicadas com antecedência sempre que possível)</li>
          <li>Atualizações de segurança ou funcionalidades</li>
          <li>Situações de força maior fora do controle da empresa</li>
        </ul>
        <p>A OrganizaPro não se responsabiliza por indisponibilidades decorrentes de falhas de conexão, dispositivos ou provedores de internet do próprio cliente.</p>
      </Secao>

      <Secao titulo="6. Atualizações">
        <p>A plataforma está em constante evolução. O cliente poderá receber, sem custo adicional:</p>
        <ul style={lista}>
          <li>Novas funcionalidades</li>
          <li>Melhorias de desempenho e usabilidade</li>
          <li>Correções de eventuais problemas</li>
        </ul>
        <p>As atualizações são realizadas de forma a não prejudicar o funcionamento contratado.</p>
      </Secao>

      <Secao titulo="7. Propriedade intelectual">
        <p>Todo o conteúdo da plataforma OrganizaPro — incluindo software, código, identidade visual, marca, logotipo e tecnologia — é de propriedade exclusiva da <strong>MLT EMPREENDIMENTOS DIGITAIS LTDA</strong> e protegido pela legislação brasileira de propriedade intelectual.</p>
        <p>O cliente recebe uma <strong>licença de uso</strong> da plataforma durante a vigência do contrato. Essa licença não transfere qualquer direito de propriedade sobre o software ou a tecnologia envolvida.</p>
      </Secao>

      <Secao titulo="8. Encerramento do uso">
        <p>Em caso de encerramento do contrato, por qualquer motivo, o acesso à plataforma será desativado conforme as regras estabelecidas no Contrato de Prestação de Serviços.</p>
        <p>O cliente poderá solicitar a exportação dos seus dados em até <strong>30 dias</strong> após o encerramento, pelo e-mail <EmailContato />.</p>
      </Secao>

      <Secao titulo="9. Alterações destes termos">
        <p>Estes Termos de Uso poderão ser atualizados sempre que necessário para refletir:</p>
        <ul style={lista}>
          <li>Melhorias ou novas funcionalidades da plataforma</li>
          <li>Alterações na legislação aplicável</li>
          <li>Evolução dos serviços prestados</li>
        </ul>
        <p>Quando houver alterações relevantes, o cliente será comunicado pelos canais oficiais com antecedência razoável.</p>
      </Secao>

      <Secao titulo="10. Contato">
        <p>Dúvidas, sugestões ou solicitações relacionadas a estes Termos de Uso podem ser encaminhadas pelo e-mail oficial <EmailContato />.</p>
      </Secao>
    </DocumentoLegal>
  );
}
