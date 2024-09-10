let totalLastRewards = 0;
let totalNextRewards = 0;
let indexCounter = 1;
let isLoadingComplete = false;

function fetchBalances() {
    const eventSource = new EventSource('/balance-updates');
    const balanceRows = document.getElementById('balance-rows');
    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('progress-container');
    const completeMessage = document.getElementById('complete-message');

    balanceRows.innerHTML = '';

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        const addressShort = `${data.address.slice(0, 5)}...${data.address.slice(-4)}`;
        const nodeIDShort = `${data.nodeID.slice(0, 5)}...${data.nodeID.slice(-4)}`;

        if (data.lastReward && !isNaN(data.lastReward)) {
            totalLastRewards += parseFloat(data.lastReward);
        }
        if (data.nextReward && !isNaN(data.nextReward)) {
            totalNextRewards += parseFloat(data.nextReward);
        }

        const row = document.createElement('tr');
        row.innerHTML = `
                    <td>${indexCounter++}</td>
                    <td>
                      ${addressShort}
                      <i class="bi bi-clipboard-fill text-muted mx-2" style="cursor: pointer;" title="Copy Address" onclick="copyToClipboard('${data.address}')"></i>
                      <a href="https://etherscan.io/address/${data.address}" target="_blank" title="View on Etherscan">
                        <i class="bi bi-box-arrow-up-right text-muted"></i>
                      </a>
                    </td>
                    <td>${data.eth && !isNaN(data.eth) ? parseFloat(data.eth).toFixed(5) : 'N/A'}</td>
                    <td>$${data.ethUsd && !isNaN(data.ethUsd) ? parseFloat(data.ethUsd).toFixed(2) : 'N/A'}</td>
                    <td>${data.fet && !isNaN(data.fet) ? parseFloat(data.fet).toFixed(2) : 'N/A'}</td>
                    <td>$${data.fetUsd && !isNaN(data.fetUsd) ? parseFloat(data.fetUsd).toFixed(2) : 'N/A'}</td>
                    <td>${data.lastReward && !isNaN(data.lastReward) ? parseFloat(data.lastReward).toFixed(2) : 'N/A'}</td>
                    <td>${data.lastUptime || 'N/A'}</td>
                    <td>${data.nextReward && !isNaN(data.nextReward) ? parseFloat(data.nextReward).toFixed(2) : 'N/A'}</td>
                    <td>${data.currentUptime || 'N/A'}</td>
                    <td data-sort="${data.lastPosition && !isNaN(data.lastPosition) ? data.lastPosition : -1}">
                      ${data.lastPosition && !isNaN(data.lastPosition) ? parseInt(data.lastPosition) + 1 : 'N/A'}
                    </td>
                    <td data-sort="${data.currentPosition && !isNaN(data.currentPosition) ? data.currentPosition : -1}">
                      ${data.currentPosition && !isNaN(data.currentPosition) ? parseInt(data.currentPosition) + 1 : 'N/A'}
                    </td>
                    <td>
                      ${nodeIDShort}
                      <i class="bi bi-clipboard-fill text-muted mx-2" style="cursor: pointer;" title="Copy Node ID" onclick="copyToClipboard('${data.nodeID}')"></i>
                    </td>
                `;
        balanceRows.appendChild(row);

        document.getElementById('total-eth').textContent = data.totalEth && !isNaN(data.totalEth) ? parseFloat(data.totalEth).toFixed(5) : 'N/A';
        document.getElementById('total-fet').textContent = data.totalFet && !isNaN(data.totalFet) ? parseFloat(data.totalFet).toFixed(2) : 'N/A';
        document.getElementById('total-eth-usd').textContent = `${data.totalEthUsd && !isNaN(data.totalEthUsd) ? '$' + parseFloat(data.totalEthUsd).toFixed(2) : 'N/A'}`;
        document.getElementById('total-fet-usd').textContent = `${data.totalFetUsd && !isNaN(data.totalFetUsd) ? '$' + parseFloat(data.totalFetUsd).toFixed(2) : 'N/A'}`;

        document.getElementById('total-last-rewards').textContent = totalLastRewards.toFixed(2);
        document.getElementById('total-next-rewards').textContent = totalNextRewards.toFixed(2);

        if (progressBar && data.percentage) {
            progressBar.style.width = `${data.percentage}%`;
            progressBar.setAttribute('aria-valuenow', data.percentage);
            progressBar.textContent = `${data.percentage}%`;
        }

        if (data.percentage === 100) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
                completeMessage.style.display = 'block';
            }, 500);
            isLoadingComplete = true;
            initializeDataTables();
        }
    };

    eventSource.addEventListener('end', () => {
        eventSource.close();
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard');
    });
}

function initializeDataTables() {
    if (isLoadingComplete) {
        const table = $('#balance-table').DataTable({
            paging: true,
            searching: true,
            ordering: true,
            order: [[0, 'asc']],
            responsive: true,
            pageLength: 5,
            lengthMenu: [5, 10, 25, 50, 100]
        });

        $('.toggle-column').on('change', function () {
            const column = table.column($(this).attr('data-column'));
            column.visible(!column.visible());
        });
    }
}

window.onload = fetchBalances;