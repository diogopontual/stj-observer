const fetch = require("node-fetch");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const accents = require("remove-accents");
const pdfjs = require('pdfjs-dist/es5/build/pdf.js');
const fs = require("fs");
const { Readable } = require('stream');

let dataInicial = "01/02/2019",
  dataFinal = "01/02/2019";
const LINK_REGEX = /sequencial\=(?<seq>[0-9]*).*num_registro\=(?<nreg>[0-9]*).*data\=(?<dt>[0-9]*).*/;
const LINK =
  "https://ww2.stj.jus.br/websecstj/cgi/revista/REJ.cgi/ITA?seq=${seq}&tipo=0&nreg=${nreg}&SeqCgrmaSessao=&CodOrgaoJgdr=&dt=${dt}&formato=PDF&salvar=false";
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
  let detalhes = await getDetalhes(body);
  let decisoes = await getDecisoes(body);
  console.log(decisoes);
  return body;
};

let getDetalhes = function (body) {
  //classSpanDetalhesTexto
  let dom = new JSDOM(body);
  let list = dom.window.document.querySelectorAll(
    "#idDivDetalhes .classDivLinhaDetalhes"
  );
  let retval = {};
  for (let detalhe of list) {
    let label = detalhe
      .querySelector(".classSpanDetalhesLabel")
      .textContent.trim();
    if (label.length > 0) {
      label = accents
        .remove(label)
        .replace(/\(.\)|:/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();
      retval[label] = detalhe
        .querySelector(".classSpanDetalhesTexto")
        .textContent.trim()
        .replace(/\s+/g, " ");
    }
  }
  return retval;
};

let createLink = function (endpoint, seq, nreg, dt) {
  return `https://ww2.stj.jus.br/websecstj/cgi/revista/REJ.cgi/${endpoint}?seq=${seq}&tipo=0&nreg=${nreg}&SeqCgrmaSessao=&CodOrgaoJgdr=&dt=${dt}&formato=PDF&salvar=false`;
};

async function getPdfText(data) {
  let doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  let pageTexts = Array.from({ length: doc.numPages }, async (v, i) => {
    return (await (await doc.getPage(i + 1)).getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false
    })).items
      .map((token) => token.str)
      .join(" ").replace(/ +/g, ' ');
  });
  return (await Promise.all(pageTexts)).join("");
}

let downloadFile = async function (url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/pdf",
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
  let buffer = await new Promise((resolve, reject) => {
    res.arrayBuffer().then(function (buffer) {
      resolve(buffer);
    });
  });
  return buffer;
};
let getDecisoes = async function (body) {
  let retval = [];
  //classSpanDetalhesTexto
  let dom = new JSDOM(body);
  let list = dom.window.document.querySelectorAll(
    "#idDivDecisoes .classDivConteudoPesquisaProcessual"
  );
  for (let detalhe of list) {
    for (let child of detalhe.children) {
      let clazz = child.className;
      if (clazz == "clsDecisoesMonocraticasBlocoExterno") {
        let links = child.querySelectorAll(".clsDecisoesMonocraticasTopoLink");
        let ministro = child.querySelector(".clsDecisoesMonocraticasLinhaMinistroNome");
        for (let link of links) {
          let onclick = link.attributes["onclick"].value;
          let titulo = link.textContent;
          let {
            groups: { tipoRecurso, dataPublicacao },
          } = titulo.match(/^(?<tipoRecurso>[a-zA-Z]+)\s.* - (?<dataPublicacao>[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9][0-9][0-9])\)/);
          let {
            groups: { seq, nreg, dt },
          } = onclick.match(LINK_REGEX);
          let docUrl = createLink("MON", seq, nreg, dt);
          let pdf = await downloadFile(docUrl);
          let texto = await getPdfText(pdf);
          // fs.writeFileSync(`/home/diogopontual/tmp/${(new Date()).getTime()}.pdf`, pdf);
          retval.push(
            {
              dataPublicacao: dataPublicacao,
              tipoRecurso: tipoRecurso,
              tipoDecisao: "MONOCRATICA",
              texto: texto,
              titulo: titulo,
              link: docUrl,
              ministro: (ministro ? ministro.textContent.replace('-', '').trim() : null)
            });
        }
      } else if (clazz == "classDivLinhaDecisoesDocumentos") {
      }
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
