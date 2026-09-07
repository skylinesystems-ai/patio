# Controle de Pátio

Aplicação frontend para controle de caminhões, Troller 40, Troller 20 e carretas baú.

## Tecnologias
- HTML5
- CSS3
- JavaScript Vanilla
- LocalStorage

## Executar
Abra `index.html` diretamente no navegador. Não há backend ou instalação de dependências.

## Persistência
Os dados ficam no LocalStorage do navegador, na chave `controlePatio.v1`.

## Estrutura
- `index.html`
- `css/style.css`
- `js/app.js`
- `js/storage.js`
- `js/vehicles.js`
- `js/maintenance.js`
- `assets/icons/`

## Regras principais
- Cadastro começa com status LIBERADO.
- Manutenção bloqueante aberta => BLOQUEADO.
- Manutenção não bloqueante aberta, sem bloqueante => PENDÊNCIA.
- Só fica LIBERADO quando não há manutenção bloqueante aberta.
- Liberação forçada exige digitar `LIBERAR`.
- Veículo desativado não é apagado e sai da seleção padrão.
