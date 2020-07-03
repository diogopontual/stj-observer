const fetch = require("node-fetch");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const accents = require('remove-accents');
let dataInicial = "01/02/2019",
  dataFinal = "01/02/2019";

let getNumeroDeProcessos = function (body) {
  const regex = /Pesquisa resultou em <b>([0-9]*)<\/b> registro\(s\)!/;
  let match = regex.exec(body);
  if (match.length && match.length > 1) return match[1];
  return 0;
};

let getProcessos = async function (body) {
  let dom = new JSDOM(body);
  let list = dom.window.document.querySelectorAll(
    "span.clsBlocoProcessoColuna.clsBlocoProcessoColuna1.classSpanProcessoUF a"
  );
  for (var processo of list) {
    await fetchProcesso(processo.href);
  }
};

let fetchProcesso = async function (href) {
  let url = `https://ww2.stj.jus.br/${href}`;
  const response = await fetch(url, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "pt,en-US;q=0.9,en;q=0.8,ro;q=0.7",
      origin: "https://ww2.stj.jus.br",
      Referer:
        "https://ww2.stj.jus.br/processo/pesquisa/?aplicacao=processos.ea",
      "cache-control": "max-age=0",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    },
    referrer: "https://ww2.stj.jus.br/processo/pesquisa/",
    referrerPolicy: "no-referrer-when-downgrade",
    body: null,
    method: "GET",
    mode: "cors",
  });
  const body = await response.textConverted();
  let detalhes = getDetalhes(body);
  console.log(detalhes);
  return body;
};

let getDetalhes = function (body) {
  //classSpanDetalhesTexto
  let dom = new JSDOM(body);
  let list = dom.window.document.querySelectorAll("#idDivDetalhes .classDivLinhaDetalhes");
  let retval = {};
  for (let detalhe of list) {
    let label = detalhe.querySelector('.classSpanDetalhesLabel').textContent.trim();
    if(label.length > 0){
      label = accents.remove(label).replace(/\(.\)|:/g,'').trim().replace(/\s+/g,'-').toLowerCase();
      retval[label] = detalhe.querySelector('.classSpanDetalhesTexto').textContent.trim().replace(/\s+/g,' ');
    }
  }
  return retval;
};

(async () => {
  const response = await fetch("https://ww2.stj.jus.br/processo/pesquisa/", {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "pt,en-US;q=0.9,en;q=0.8,ro;q=0.7",
      "cache-control": "max-age=0",
      origin: "https://ww2.stj.jus.br",
      Referer:
        "https://ww2.stj.jus.br/processo/pesquisa/?aplicacao=processos.ea",
      "Accept-Charset": "utf-8",
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
    },
    referrer:
      "https://ww2.stj.jus.br/processo/pesquisa/?aplicacao=processos.ea",
    referrerPolicy: "no-referrer-when-downgrade",
    body: `aplicacao=processos.ea&acao=pushconsultarprocessoconsultalimitenaoatendidasjaincluidas&descemail=&senha=&totalRegistrosPorPagina=100&tipoRamosDireitoSelecionados=PN%2CPP%2C&tipoPesquisaSecundaria=&sequenciaisParteAdvogado=-1&refinamentoAdvogado=&refinamentoParte=&tipoOperacaoFonetica=&tipoOperacaoFoneticaPhonos=2&origemOrgaosSelecionados=&origemUFSelecionados=&julgadorOrgaoSelecionados=&tipoRamosDireitoSelecionados=&situacoesSelecionadas=&num_processo=&num_registro=&numeroUnico=&numeroOriginario=&advogadoCodigo=&dataAutuacaoInicial=&dataAutuacaoFinal=&pautaPublicacaoDataInicial=${encodeURI(
      dataInicial
    )}&pautaPublicacaoDataFinal=${encodeURI(
      dataFinal
    )}&dataPublicacaoInicial=&dataPublicacaoFinal=&parteAutor=FALSE&parteReu=FALSE&parteOutros=FALSE&parteNome=&opcoesFoneticaPhonosParte=2&quantidadeMinimaTermosPresentesParte=1&advogadoNome=&opcoesFoneticaPhonosAdvogado=2&quantidadeMinimaTermosPresentesAdvogado=1&conectivo=OU&listarProcessosOrdemDescrecente=TRUE&listarProcessosOrdemDescrecenteTemp=TRUE&listarProcessosAtivosSomente=FALSE&listarProcessosEletronicosSomente=FALSE`,
    method: "POST",
    mode: "cors",
  });
  const body = await response.textConverted();
  let numeroDeRegistros = getNumeroDeProcessos(body);
  getProcessos(body);
})();
